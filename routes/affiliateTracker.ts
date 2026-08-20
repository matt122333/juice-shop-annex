/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE affiliates (id INTEGER PRIMARY KEY, name TEXT, clicks INTEGER, payout REAL);
  INSERT INTO affiliates (name, clicks, payout) VALUES
    ('JuiceFan', 150, 12.50), ('FreshDeals', 300, 25.00);
`)

// Record an affiliate click and redirect to the affiliate's landing page.
export function recordClick () {
  return (req: Request, res: Response) => {
    const target = String(req.query.target ?? '/')
    const ref = String(req.query.ref ?? 'direct')
    db.prepare('UPDATE affiliates SET clicks = clicks + 1 WHERE name = ?').run(ref)
    res.redirect(target)
  }
}

// Aggregate affiliate statistics grouped by a user-selected column.
export function affiliateStats () {
  return (req: Request, res: Response) => {
    const groupBy = String(req.query.group ?? 'name')
    const query = `SELECT ${groupBy}, SUM(clicks) as totalClicks, SUM(payout) as totalPayout FROM affiliates GROUP BY ${groupBy}`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Render the affiliate leaderboard page.
export function leaderboard () {
  return (req: Request, res: Response) => {
    const title = String(req.query.title ?? 'Top Affiliates')
    const rows = db.prepare('SELECT name, clicks FROM affiliates ORDER BY clicks DESC').all() as any[]
    const html = `<h1>${title}</h1><table>${rows.map(r => `<tr><td>${r.name}</td><td>${r.clicks}</td></tr>`).join('')}</table>`
    res.type('text/html').send(html)
  }
}
