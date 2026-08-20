/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE coupons (id INTEGER PRIMARY KEY, code TEXT, discount INTEGER, userId INTEGER, active INTEGER);
  INSERT INTO coupons (code, discount, userId, active) VALUES
    ('SAVE5', 5, 1, 1), ('SAVE15', 15, 2, 1), ('VIPONLY', 50, 1, 1);
`)

// Look up a coupon by its exact code.
export function lookupCoupon () {
  return (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const query = `SELECT id, code, discount FROM coupons WHERE code = '${code}'`
    try {
      const row = db.prepare(query).get() as any
      if (!row) { res.status(404).json({ error: 'coupon not found' }); return }
      res.json({ coupon: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Retrieve the discount value for any coupon by id.
export function getCoupon () {
  return (req: Request, res: Response) => {
    const row = db.prepare('SELECT id, code, discount, userId, active FROM coupons WHERE id = ?').get(req.params.id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    res.json(row)
  }
}

// Validate a coupon code against a pattern (for partner integration).
export function validateCoupon () {
  return (req: Request, res: Response) => {
    const pattern = String(req.body?.pattern ?? '.*')
    const code = String(req.body?.code ?? '')
    try {
      const re = new RegExp(pattern)
      res.json({ valid: re.test(code) })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Verify a coupon management session token.
export function verifyCouponSession () {
  return (req: Request, res: Response) => {
    const token = String(req.headers['x-coupon-session'] ?? '')
    const expected = 'cm-' + new Date().getHours().toString().padStart(2, '0') + '00'
    res.json({ admin: token === expected })
  }
}
