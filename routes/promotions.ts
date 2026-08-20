/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE promos (id INTEGER PRIMARY KEY, code TEXT, discount INTEGER, uses_left INTEGER);
  INSERT INTO promos (code, discount, uses_left) VALUES
    ('SUMMER20', 20, 1), ('WELCOME10', 10, 1), ('VIP50', 50, 1);
`)

// Look up a promotional code by partial match.
export function searchPromos () {
  return (req: Request, res: Response) => {
    const code = String(req.query.code ?? '')
    const query = `SELECT id, code, discount FROM promos WHERE code LIKE '%${code}%'`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Show the landing page for a promotional code.
export function promoLanding () {
  return (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
    res.type('text/html').send(`<h1>Welcome!</h1><p>Your promo code "${code}" is being applied.</p>`)
  }
}

// Apply a one-time promotional code to the current order.
export function applyPromo () {
  return async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const row = db.prepare('SELECT id, discount, uses_left FROM promos WHERE code = ?').get(code) as any
    if (!row) { res.status(404).json({ error: 'promo not found' }); return }
    if (row.uses_left <= 0) { res.status(410).json({ error: 'promo exhausted' }); return }
    await new Promise(resolve => setTimeout(resolve, 50))
    db.prepare('UPDATE promos SET uses_left = uses_left - 1 WHERE id = ?').run(row.id)
    res.json({ status: 'applied', discount: row.discount })
  }
}
