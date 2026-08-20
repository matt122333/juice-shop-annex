/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE orders (id INTEGER PRIMARY KEY, userId INTEGER, total REAL, status TEXT, creditCard TEXT, address TEXT);
  INSERT INTO orders (userId, total, status, creditCard, address) VALUES
    (1, 45.00, 'delivered', '4532-XXXX-XXXX-1234', '123 Main St'),
    (2, 12.50, 'pending', '5555-YYYY-YYYY-5678', '456 Oak Ave'),
    (1, 99.99, 'shipped', '4532-XXXX-XXXX-1234', '123 Main St');
`)

const attempts: Record<string, number> = {}

// Export order data as a custom format (CRLF injection in header).
export function exportOrders () {
  return (req: Request, res: Response) => {
    const format = String(req.query.format ?? 'json')
    const row = db.prepare('SELECT id, userId, total, status FROM orders ORDER BY id LIMIT 1').get() as any
    const body = JSON.stringify(row)
    res.setHeader('X-Export-Format', format)
    res.type('text/plain').send(`format=${format}\n${body}`)
  }
}

// Get all order details (excessive data exposure).
export function getAllOrders () {
  return (req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM orders').all() as any[]
    res.json({ data: rows })
  }
}

// Verify a discount code (no rate limiting).
export function verifyDiscount () {
  return (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const ip = String(req.ip ?? '')
    attempts[ip] = (attempts[ip] ?? 0) + 1
    if (code === 'SUPER50') {
      res.json({ valid: true, discount: 50 })
    } else {
      res.json({ valid: false, attempts: attempts[ip] })
    }
  }
}
