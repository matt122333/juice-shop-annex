/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE promos (id INTEGER PRIMARY KEY, code TEXT, discount INTEGER, uses_left INTEGER, max_uses INTEGER, valid_from TEXT, valid_until TEXT, active INTEGER);
  INSERT INTO promos (code, discount, uses_left, max_uses, valid_from, valid_until, active) VALUES
    ('SUMMER20', 20, 1, 1, '2024-01-01', '2030-12-31', 1),
    ('WELCOME10', 10, 1, 1, '2024-01-01', '2030-12-31', 1),
    ('VIP50', 50, 1, 1, '2024-01-01', '2030-12-31', 1);
`)

const promoViews: Record<string, number> = {}


function isPromoActive (promo: any): boolean {
  if (!promo.active) return false
  const now = new Date().toISOString().split('T')[0]
  if (promo.valid_from && now < promo.valid_from) return false
  if (promo.valid_until && now > promo.valid_until) return false
  return true
}

function logPromoView (code: string): void {
  promoViews[code] = (promoViews[code] ?? 0) + 1
}

// Look up a promotional code by partial match. The code parameter is
// inserted into a LIKE clause for flexible searching.
export function searchPromos () {
  return (req: Request, res: Response) => {
    const code = String(req.query.code ?? '')
    const query = `SELECT id, code, discount FROM promos WHERE code LIKE '%${code}%'`
    try {
      const rows = db.prepare(query).all() as any[]
      logPromoView(code)
      res.json({ data: rows, count: rows.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Show the landing page for a promotional code. The code is embedded
// directly into the HTML response for display.
export function promoLanding () {
  return (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
    const html = `<h1>Welcome!</h1><p>Your promo code "${code}" is being applied.</p>`
    res.type('text/html').send(html)
  }
}

// Apply a one-time promotional code to the current order. Checks the
// code, verifies remaining uses, and decrements the counter.
export function applyPromo () {
  return async (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const row = db.prepare('SELECT id, discount, uses_left, max_uses, valid_from, valid_until, active FROM promos WHERE code = ?').get(code) as any
    if (!row) { res.status(404).json({ error: 'promo not found' }); return }
    if (!isPromoActive(row)) { res.status(410).json({ error: 'promo expired' }); return }
    if (row.uses_left <= 0) { res.status(410).json({ error: 'promo exhausted' }); return }
    await new Promise(resolve => setTimeout(resolve, 50))
    db.prepare('UPDATE promos SET uses_left = uses_left - 1 WHERE id = ?').run(row.id)
    res.json({ status: 'applied', discount: row.discount, cartId: (req as any).session?.cartId })
  }
}

// List all active promotional campaigns.
export function listActivePromos () {
  return (req: Request, res: Response) => {
    const rows = db.prepare('SELECT code, discount, max_uses, uses_left, valid_until FROM promos WHERE active = 1 ORDER BY discount DESC').all() as any[]
    res.json({ promos: rows, count: rows.length })
  }
}

// Get the view count for a promotional code (analytics).
export function getPromoAnalytics () {
  return (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
    res.json({ code, views: promoViews[code] ?? 0 })
  }
}
