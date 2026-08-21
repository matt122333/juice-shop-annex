/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')

db.exec(`CREATE TABLE orders (id INTEGER PRIMARY KEY, ordered_at TEXT NOT NULL, customer_id INTEGER NOT NULL, category TEXT NOT NULL, product TEXT NOT NULL, quantity INTEGER NOT NULL, total REAL NOT NULL);
  INSERT INTO orders VALUES (1,'2026-01-15',1,'Snacks','Apple Juice',3,8.97),(2,'2026-02-10',2,'Drinks','Orange Juice',2,5.98),(3,'2026-02-21',1,'Snacks','Apple Juice',1,2.99);`)

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const validDate = (value: unknown): value is string => typeof value === 'string' && datePattern.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const singleQuery = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined
  return typeof value === 'string' ? value : undefined
}
const fail = (res: Response, message = 'Unable to process analytics request'): void => { res.status(400).json({ error: message }) }

export function getSalesSummary () {
  return (req: Request, res: Response): void => {
    const from = singleQuery(req.query.from) ?? '2026-01-01'
    const to = singleQuery(req.query.to) ?? '2026-12-31'
    if (!validDate(from) || !validDate(to) || from > to) return fail(res, 'Invalid date range')
    try {
      const summary = db.prepare('SELECT COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ordered_at BETWEEN ? AND ?').get(from, to)
      res.json({ from, to, summary })
    } catch { res.status(500).json({ error: 'Unable to load sales summary' }) }
  }
}

export function getTopProducts () {
  return (req: Request, res: Response): void => {
    const rawLimit = singleQuery(req.query.limit) ?? '10'
    const limit = Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return fail(res, 'Limit must be an integer between 1 and 100')
    try { res.json({ products: db.prepare('SELECT product, SUM(quantity) AS unitsSold, SUM(total) AS revenue FROM orders GROUP BY product ORDER BY unitsSold DESC LIMIT ?').all(limit) }) } catch { res.status(500).json({ error: 'Unable to load products' }) }
  }
}

export function getRevenueByCategory () {
  return (_req: Request, res: Response): void => {
    try { res.json({ categories: db.prepare('SELECT category, SUM(total) AS revenue FROM orders GROUP BY category ORDER BY revenue DESC').all() }) } catch { res.status(500).json({ error: 'Unable to load category revenue' }) }
  }
}

export function getCustomerMetrics () {
  return (_req: Request, res: Response): void => {
    try { res.json({ metrics: db.prepare('SELECT COUNT(DISTINCT customer_id) AS customers, COUNT(*) AS orders, ROUND(CAST(COUNT(*) AS REAL) / COUNT(DISTINCT customer_id), 2) AS ordersPerCustomer FROM orders').get() }) } catch { res.status(500).json({ error: 'Unable to load customer metrics' }) }
  }
}

export function exportDashboard () {
  return (_req: Request, res: Response): void => {
    try {
      const sales = db.prepare('SELECT COUNT(*) AS orderCount, COALESCE(SUM(total), 0) AS revenue FROM orders').get()
      const categories = db.prepare('SELECT category, SUM(total) AS revenue FROM orders GROUP BY category').all()
      res.json({ generatedAt: new Date().toISOString(), sales, categories })
    } catch { res.status(500).json({ error: 'Unable to export dashboard' }) }
  }
}
