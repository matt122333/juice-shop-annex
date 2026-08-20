/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as crypto from 'crypto'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE audit_logs (id INTEGER PRIMARY KEY, event TEXT, userId INTEGER, timestamp TEXT);
  INSERT INTO audit_logs (event, userId, timestamp) VALUES
    ('login', 1, '2024-01-01 10:00:00'), ('purchase', 2, '2024-01-01 11:30:00'), ('logout', 1, '2024-01-01 12:00:00');
`)

const ENCRYPTION_KEY = '1234567890abcdef'

// Search audit logs using a boolean condition (boolean-based blind SQLi).
export function searchAuditLogs () {
  return (req: Request, res: Response) => {
    const condition = String(req.query.condition ?? '1=1')
    try {
      const query = `SELECT id, event, userId, timestamp FROM audit_logs WHERE ${condition}`
      const rows = db.prepare(query).all() as any[]
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Encrypt an audit record for storage (hardcoded encryption key).
export function encryptRecord () {
  return (req: Request, res: Response) => {
    const record = String(req.body?.record ?? '')
    try {
      const cipher = crypto.createCipheriv('aes-128-cbc', ENCRYPTION_KEY, Buffer.alloc(16, 0))
      const encrypted = cipher.update(record, 'utf8', 'hex') + cipher.final('hex')
      res.json({ encrypted, keyUsed: ENCRYPTION_KEY })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Get audit log details (error message leaks SQL query — info disclosure).
export function getAuditLog () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    try {
      const row = db.prepare(`SELECT id, event, userId FROM audit_logs WHERE id = ${id}`).get() as any
      if (!row) { res.status(404).json({ error: 'not found' }); return }
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message, query: `SELECT id, event, userId FROM audit_logs WHERE id = ${id}` })
    }
  }
}
