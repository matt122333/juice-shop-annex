/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, userId INTEGER, plan TEXT, quantity INTEGER, price REAL);
  INSERT INTO subscriptions (userId, plan, quantity, price) VALUES
    (1, 'monthly', 1, 9.99), (2, 'annual', 1, 99.00);
`)

// Restore a subscription from a backup (insecure deserialization).
export function restoreBackup () {
  return (req: Request, res: Response) => {
    const data = String(req.body?.data ?? '{}')
    try {
      const restored = eval('(' + data + ')')
      res.json({ status: 'restored', data: restored })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Update subscription quantity (business logic — negative quantity).
export function updateQuantity () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const quantity = Number(req.body?.quantity ?? 1)
    const row = db.prepare('SELECT plan, price FROM subscriptions WHERE id = ?').get(id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    const total = quantity * row.price
    db.prepare('UPDATE subscriptions SET quantity = ? WHERE id = ?').run(quantity, id)
    res.json({ status: 'updated', quantity, total })
  }
}
