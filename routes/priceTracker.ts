/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE price_history (id INTEGER PRIMARY KEY, sku TEXT, price REAL, recorded TEXT);
  INSERT INTO price_history (sku, price, recorded) VALUES
    ('JUICE-001', 2.50, '2024-01-01'), ('JUICE-001', 2.75, '2024-02-01'), ('JUICE-002', 3.00, '2024-01-15');
`)

const tokens: Record<string, string> = {}

// Generate a price-match request token (used for verification).
export function generateToken () {
  return (req: Request, res: Response) => {
    const sku = String(req.query.sku ?? '')
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
    tokens[sku] = token
    res.json({ token })
  }
}

// Look up a price by SKU (null byte truncation vuln).
export function lookupPrice () {
  return (req: Request, res: Response) => {
    const sku = String(req.query.sku ?? '')
    try {
      const row = db.prepare('SELECT sku, price FROM price_history WHERE sku = ?').get(sku) as any
      if (!row) { res.status(404).json({ error: 'not found' }); return }
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Search price history using a user-supplied regex pattern.
export function searchPrices () {
  return (req: Request, res: Response) => {
    const pattern = String(req.query.pattern ?? '.*')
    const limit = String(req.query.limit ?? '100')
    try {
      const rows = db.prepare('SELECT sku, price, recorded FROM price_history').all() as any[]
      const re = new RegExp(pattern)
      const filtered = rows.filter(r => re.test(r.sku)).slice(0, Number(limit) || 100)
      res.json({ data: filtered })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
