/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE inventory (id INTEGER PRIMARY KEY, sku TEXT, stock INTEGER, supplier TEXT, cost REAL);
  INSERT INTO inventory (sku, stock, supplier, cost) VALUES
    ('JUICE-001', 50, 'FreshFarms', 2.50), ('JUICE-002', 0, 'GreenCo', 3.00), ('JUICE-003', 100, 'NatureBest', 1.75);
`)

const passwords: Record<string, string> = { admin: 'adminpass123', manager: 'mgr456' }

// Verify a supplier portal password using direct string comparison.
export function verifyPassword () {
  return (req: Request, res: Response) => {
    const user = String(req.body?.user ?? '')
    const pass = String(req.body?.password ?? '')
    const stored = passwords[user]
    if (!stored) { res.status(404).json({ error: 'user not found' }); return }
    if (stored === pass) {
      res.json({ verified: true })
    } else {
      res.json({ verified: false })
    }
  }
}

// Look up inventory details by SKU with error information.
export function inventoryDetails () {
  return (req: Request, res: Response) => {
    const sku = String(req.query.sku ?? '')
    try {
      const row = db.prepare(`SELECT id, sku, stock, supplier FROM inventory WHERE sku = '${sku}'`).get() as any
      if (!row) { res.status(404).json({ error: 'SKU not found' }); return }
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message, stack: err.stack })
    }
  }
}

// Filter inventory items by type (uses typeof for validation).
export function filterInventory () {
  return (req: Request, res: Response) => {
    const type = req.body?.type
    if (typeof type === 'string') {
      const rows = db.prepare('SELECT id, sku, stock FROM inventory WHERE supplier = ?').all(type) as any[]
      res.json({ data: rows })
      return
    }
    if (typeof type === 'number') {
      const rows = db.prepare('SELECT id, sku, stock FROM inventory WHERE stock > ?').all(type) as any[]
      res.json({ data: rows })
      return
    }
    if (type && typeof type === 'object') {
      const rows = db.prepare(`SELECT id, sku, stock FROM inventory WHERE ${type.column} = ${type.value}`).all() as any[]
      res.json({ data: rows })
      return
    }
    res.json({ data: [] })
  }
}
