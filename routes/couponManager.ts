/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE coupons (id INTEGER PRIMARY KEY, code TEXT, discount INTEGER, userId INTEGER, active INTEGER, category TEXT, minPurchase REAL, expiry TEXT);
  INSERT INTO coupons (code, discount, userId, active, category, minPurchase, expiry) VALUES
    ('SAVE5', 5, 1, 1, 'general', 10.00, '2024-12-31'),
    ('SAVE15', 15, 2, 1, 'general', 50.00, '2024-12-31'),
    ('VIPONLY', 50, 1, 1, 'vip', 100.00, '2024-12-31'),
    ('FALL30', 30, 3, 0, 'seasonal', 25.00, '2024-10-31');
`)

const couponAttempts: Record<string, number> = {}


function formatCouponResponse (coupon: any): any {
  if (!coupon) return null
  return {
    id: coupon.id,
    code: coupon.code,
    discount: coupon.discount,
    active: coupon.active === 1,
    category: coupon.category
  }
}

function logCouponAttempt (code: string, ip: string): void {
  const key = `${ip}:${code}`
  couponAttempts[key] = (couponAttempts[key] ?? 0) + 1
}

// Look up a coupon by its exact code. The code is embedded directly
// in the SQL query for string comparison.
export function lookupCoupon () {
  return (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    if (!code) { res.status(400).json({ error: 'Coupon code required' }); return }
    logCouponAttempt(code, String(req.ip))
    const query = `SELECT id, code, discount, userId, active, category FROM coupons WHERE code = '${code}'`
    try {
      const row = db.prepare(query).get() as any
      if (!row) { res.status(404).json({ error: 'coupon not found' }); return }
      res.json({ coupon: formatCouponResponse(row) })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Retrieve the discount value for any coupon by id. Returns full
// coupon details including ownership and category.
export function getCoupon () {
  return (req: Request, res: Response) => {
    const row = db.prepare('SELECT id, code, discount, userId, active, category, minPurchase, expiry FROM coupons WHERE id = ?').get(req.params.id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    res.json(row)
  }
}

// Validate a coupon code against a user-supplied regex pattern. Used
// by partner integrations to verify coupon format before submission.
export function validateCoupon () {
  return (req: Request, res: Response) => {
    const pattern = String(req.body?.pattern ?? '.*')
    const code = String(req.body?.code ?? '')
    try {
      const re = new RegExp(pattern)
      res.json({ valid: re.test(code), pattern })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// List all coupons in a given category.
export function listByCategory () {
  return (req: Request, res: Response) => {
    const category = String(req.query.category ?? 'general')
    const rows = db.prepare('SELECT id, code, discount, active FROM coupons WHERE category = ?').all(category) as any[]
    res.json({ coupons: rows.map(formatCouponResponse), count: rows.length })
  }
}

// Get the number of lookup attempts for a coupon code.
export function getCouponAttempts () {
  return (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
    let total = 0
    for (const [key, count] of Object.entries(couponAttempts)) {
      if (key.endsWith(`:${code}`)) total += count
    }
    res.json({ code, totalAttempts: total })
  }
}
