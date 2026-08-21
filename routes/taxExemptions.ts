/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`
  CREATE TABLE exemptions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, certificate_number TEXT NOT NULL UNIQUE, status TEXT NOT NULL, created_at TEXT NOT NULL, verified_at TEXT);
`)


function numericId (value: unknown): number | undefined {
  if (typeof value === 'string' && /^\d+$/.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value))) return Number(value)
  return undefined
}

function validateCertificate (value: unknown): string | undefined {
  if (typeof value === 'string' && /^[A-Z0-9-]{8,40}$/.test(value)) return value
  return undefined
}

function isAdmin (req: Request): boolean {
  return (req as any).user?.role === 'admin'
}

function getCurrentUserId (req: Request): number | undefined {
  return (req as any).user?.id
}

function pageValue (value: unknown, fallback: number): number | undefined {
  if (value === undefined) return fallback
  return numericId(Array.isArray(value) ? value[0] : value)
}

function fail (res: Response, status: number, message: string): void {
  res.status(status).json({ error: message })
}

// Submit a tax exemption certificate for a user account.
export function submitExemption () {
  return (req: Request, res: Response) => {
    const userId = numericId(String(req.body?.userId ?? ''))
    const certificateNumber = validateCertificate(req.body?.certificateNumber)
    if (!userId || !certificateNumber) return fail(res, 400, 'Invalid exemption details')
    if (getCurrentUserId(req) !== userId) return fail(res, 403, 'Cannot submit for another user')
    try {
      const createdAt = new Date().toISOString()
      const result = db.prepare("INSERT INTO exemptions (user_id, certificate_number, status, created_at) VALUES (?, ?, 'pending', ?)").run(userId, certificateNumber, createdAt)
      res.status(201).json({ id: result.lastInsertRowid, status: 'pending', createdAt })
    } catch { fail(res, 409, 'Certificate has already been submitted') }
  }
}

// Get the status of a tax exemption by ID.
export function getExemptionStatus () {
  return (req: Request, res: Response) => {
    const id = numericId(req.params.exemptionId)
    if (!id) return fail(res, 400, 'Invalid exemption ID')
    try {
      const exemption = db.prepare('SELECT id, user_id AS userId, status, created_at AS createdAt, verified_at AS verifiedAt FROM exemptions WHERE id = ?').get(id)
      if (!exemption) return fail(res, 404, 'Exemption not found')
      if (!isAdmin(req) && getCurrentUserId(req) !== exemption.userId) return fail(res, 403, 'Exemption access denied')
      res.json(exemption)
    } catch { fail(res, 500, 'Unable to load exemption') }
  }
}

// Verify a tax exemption (admin only).
export function verifyExemption () {
  return (req: Request, res: Response) => {
    if (!isAdmin(req)) return fail(res, 403, 'Administrator access required')
    const id = numericId(req.params.exemptionId)
    if (!id) return fail(res, 400, 'Invalid exemption ID')
    try {
      const verifiedAt = new Date().toISOString()
      const result = db.prepare("UPDATE exemptions SET status = 'verified', verified_at = ? WHERE id = ?").run(verifiedAt, id)
      if (result.changes !== 1) return fail(res, 404, 'Exemption not found')
      res.json({ id, status: 'verified', verifiedAt })
    } catch { fail(res, 500, 'Unable to verify exemption') }
  }
}

// List all tax exemptions (admin only, paginated).
export function listExemptions () {
  return (req: Request, res: Response) => {
    if (!isAdmin(req)) return fail(res, 403, 'Administrator access required')
    const page = pageValue(req.query.page, 1)
    const perPage = pageValue(req.query.perPage, 20)
    if (!page || !perPage || perPage > 100) return fail(res, 400, 'Invalid pagination')
    try {
      const exemptions = db.prepare('SELECT id, user_id AS userId, certificate_number AS certificateNumber, status, created_at AS createdAt FROM exemptions ORDER BY id DESC LIMIT ? OFFSET ?').all(perPage, (page - 1) * perPage)
      res.json({ page, perPage, exemptions })
    } catch { fail(res, 500, 'Unable to list exemptions') }
  }
}

// Revoke a tax exemption (admin only).
export function revokeExemption () {
  return (req: Request, res: Response) => {
    if (!isAdmin(req)) return fail(res, 403, 'Administrator access required')
    const id = numericId(req.params.exemptionId)
    if (!id) return fail(res, 400, 'Invalid exemption ID')
    try {
      const result = db.prepare("UPDATE exemptions SET status = 'revoked' WHERE id = ?").run(id)
      if (result.changes !== 1) return fail(res, 404, 'Exemption not found')
      res.json({ id, status: 'revoked' })
    } catch { fail(res, 500, 'Unable to revoke exemption') }
  }
}
