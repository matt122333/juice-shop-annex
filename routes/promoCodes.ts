/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'
import { randomBytes } from 'crypto'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE promos (code TEXT PRIMARY KEY, discount INTEGER NOT NULL, expiresAt TEXT NOT NULL, usageLimit INTEGER NOT NULL, usageCount INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
  INSERT INTO promos VALUES ('WELCOME10',10,'2030-12-31T23:59:59.000Z',100,0,1);`)

const codePattern = /^[A-Z0-9]{1,20}$/
const isAdmin = (req: Request) => req.get('x-user-role') === 'admin'
const readCode = (value: unknown): string | undefined => {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return codePattern.test(code) ? code : undefined
}

export function listActivePromos () {
  return (_req: Request, res: Response): void => {
    const promos = db.prepare('SELECT code, discount, expiresAt FROM promos WHERE active = ? AND expiresAt > ? AND usageCount < usageLimit ORDER BY code').all(1, new Date().toISOString())
    res.status(200).json({ promos })
  }
}

export function validatePromo () {
  return (req: Request, res: Response): void => {
    const code = readCode(req.body?.code)
    if (code === undefined) { res.status(400).json({ error: 'Invalid promotional code.' }); return }
    const promo = db.prepare('SELECT code, discount, expiresAt, usageLimit, usageCount, active FROM promos WHERE code = ?').get(code)
    if (promo === undefined || promo.active !== 1 || promo.expiresAt <= new Date().toISOString() || promo.usageCount >= promo.usageLimit) {
      res.status(404).json({ error: 'Promotional code is unavailable.' }); return
    }
    res.status(200).json({ valid: true, code: promo.code, discount: promo.discount })
  }
}

export function getPromoDetails () {
  return (req: Request, res: Response): void => {
    const code = readCode(req.params.code)
    if (code === undefined) { res.status(400).json({ error: 'Invalid promotional code.' }); return }
    const promo = db.prepare('SELECT code, discount, expiresAt, usageLimit, usageCount, active FROM promos WHERE code = ?').get(code)
    if (promo === undefined) { res.status(404).json({ error: 'Promotional code not found.' }); return }
    res.status(200).json({ promo })
  }
}

export function createPromo () {
  return (req: Request, res: Response): void => {
    if (!isAdmin(req)) { res.status(403).json({ error: 'Administrator access required.' }); return }
    const discount = Number(req.body?.discount)
    const usageLimit = Number(req.body?.usageLimit)
    const expiresAt = typeof req.body?.expiresAt === 'string' ? new Date(req.body.expiresAt) : undefined
    if (!Number.isInteger(discount) || discount < 1 || discount > 100 || !Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > 100000 || expiresAt === undefined || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      res.status(400).json({ error: 'Invalid promotional code details.' }); return
    }
    const code = `PROMO${randomBytes(6).toString('hex').toUpperCase()}`
    try {
      db.prepare('INSERT INTO promos (code, discount, expiresAt, usageLimit) VALUES (?, ?, ?, ?)').run(code, discount, expiresAt.toISOString(), usageLimit)
      res.status(201).json({ code, discount, expiresAt: expiresAt.toISOString(), usageLimit })
    } catch { res.status(500).json({ error: 'Could not create promotional code.' }) }
  }
}

export function deactivatePromo () {
  return (req: Request, res: Response): void => {
    if (!isAdmin(req)) { res.status(403).json({ error: 'Administrator access required.' }); return }
    const code = readCode(req.params.code)
    if (code === undefined) { res.status(400).json({ error: 'Invalid promotional code.' }); return }
    const result = db.prepare('UPDATE promos SET active = ? WHERE code = ?').run(0, code)
    if (result.changes !== 1) { res.status(404).json({ error: 'Promotional code not found.' }); return }
    res.status(200).json({ deactivated: true })
  }
}
