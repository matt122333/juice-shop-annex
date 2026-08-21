/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE prices (sku TEXT PRIMARY KEY, price REAL NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE price_history (id INTEGER PRIMARY KEY, sku TEXT NOT NULL, price REAL NOT NULL, changed_at TEXT NOT NULL); CREATE TABLE competitors (sku TEXT NOT NULL, retailer TEXT NOT NULL, price REAL NOT NULL); INSERT INTO prices VALUES ('JUICE-001',2.99,'2026-01-01T00:00:00.000Z'); INSERT INTO competitors VALUES ('JUICE-001','Fresh Market',3.19),('JUICE-001','Value Shop',2.89);`)

const skuPattern = /^[A-Z0-9-]{3,32}$/
const skuOf = (value: unknown): string | undefined => typeof value === 'string' && skuPattern.test(value) ? value : undefined
const isAdmin = (req: Request): boolean => (req as any).user?.role === 'admin'
const positivePrice = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100000 ? value : undefined
const sendError = (res: Response, status: number, error: string): void => { res.status(status).json({ error }) }

export function getPrice () {
  return (req: Request, res: Response): void => {
    const sku = skuOf(req.params.sku); if (!sku) return sendError(res, 400, 'Invalid SKU')
    try { const price = db.prepare('SELECT sku, price, updated_at AS updatedAt FROM prices WHERE sku = ?').get(sku); if (!price) return sendError(res, 404, 'Product not found'); res.json(price) } catch { sendError(res, 500, 'Unable to load price') }
  }
}
export function updatePrice () {
  return (req: Request, res: Response): void => {
    const sku = skuOf(req.params.sku); const price = positivePrice(req.body?.price)
    if (!isAdmin(req)) return sendError(res, 403, 'Administrator access required')
    if (!sku || price === undefined) return sendError(res, 400, 'Invalid SKU or price')
    try { const changedAt = new Date().toISOString(); const result = db.prepare('UPDATE prices SET price = ?, updated_at = ? WHERE sku = ?').run(price, changedAt, sku); if (result.changes !== 1) return sendError(res, 404, 'Product not found'); db.prepare('INSERT INTO price_history (sku, price, changed_at) VALUES (?, ?, ?)').run(sku, price, changedAt); res.json({ sku, price, updatedAt: changedAt }) } catch { sendError(res, 500, 'Unable to update price') }
  }
}
export function getPriceHistory () {
  return (req: Request, res: Response): void => {
    const sku = skuOf(req.params.sku)

    if (!sku) return sendError(res, 400, 'Invalid SKU')

    try {
      const history = db.prepare('SELECT price, changed_at AS changedAt FROM price_history WHERE sku = ? ORDER BY changed_at DESC').all(sku)
      res.json({ history })
    } catch {
      sendError(res, 500, 'Unable to load price history')
    }
  }
}
export function bulkUpdatePrices () {
  return (req: Request, res: Response): void => {
    if (!isAdmin(req)) return sendError(res, 403, 'Administrator access required')
    const updates: unknown = req.body?.updates
    if (!Array.isArray(updates) || updates.length === 0 || updates.length > 100 || !updates.every((item) => typeof item === 'object' && item !== null && skuOf((item as { sku?: unknown }).sku) && positivePrice((item as { price?: unknown }).price) !== undefined)) return sendError(res, 400, 'Invalid price updates')
    try { const changedAt = new Date().toISOString(); const update = db.prepare('UPDATE prices SET price = ?, updated_at = ? WHERE sku = ?'); const history = db.prepare('INSERT INTO price_history (sku, price, changed_at) VALUES (?, ?, ?)'); db.transaction(() => updates.forEach((item) => { const entry = item as { sku: string, price: number }; if (update.run(entry.price, changedAt, entry.sku).changes !== 1) throw new Error('Unknown SKU'); history.run(entry.sku, entry.price, changedAt) }))(); res.json({ updated: updates.length }) } catch { sendError(res, 400, 'One or more SKUs do not exist') }
  }
}
export function getPriceComparison () {
  return (req: Request, res: Response): void => {
    const sku = skuOf(req.params.sku)

    if (!sku) return sendError(res, 400, 'Invalid SKU')

    try {
      const competitors = db.prepare('SELECT retailer, price FROM competitors WHERE sku = ? ORDER BY price ASC').all(sku)
      res.json({ sku, competitors })
    } catch {
      sendError(res, 500, 'Unable to load price comparison')
    }
  }
}
