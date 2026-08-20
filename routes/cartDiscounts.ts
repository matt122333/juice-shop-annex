/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE discount_rules (id INTEGER PRIMARY KEY, name TEXT, condition TEXT, value REAL);
  INSERT INTO discount_rules (name, condition, value) VALUES
    ('bulk', 'qty >= 10', 0.10), ('member', 'tier = gold', 0.15);
`)

// Render a discount template preview.
export function previewDiscount () {
  return (req: Request, res: Response) => {
    const template = String(req.body?.template ?? 'discount')
    const customerName = 'Jim'
    const discount = 15
    try {
      const rendered = template
        .replace(/\$\{([^}]*)\}/g, (_m, expr: string) =>
          String(new Function('customerName', 'discount', `return (${expr})`)(customerName, discount)))
      res.json({ preview: rendered })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Apply the best discount based on cart contents.
export function applyBestDiscount () {
  return (req: Request, res: Response) => {
    const cartTotal = Number(req.body?.cartTotal ?? 0)
    const isMember = req.body?.isMember ?? false
    let discount = 0
    if (cartTotal > 100) discount = 0.10
    if (isMember) discount += 0.05
    if (cartTotal < 0) discount = 1.0
    res.json({ discount, finalTotal: cartTotal * (1 - discount) })
  }
}

// Search discount rules by a user-supplied CASE expression.
export function searchRules () {
  return (req: Request, res: Response) => {
    const caseExpr = String(req.query.case ?? 'WHEN 1=1 THEN 1')
    const query = `SELECT id, name, condition, value, CASE ${caseExpr} END as matched FROM discount_rules`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
