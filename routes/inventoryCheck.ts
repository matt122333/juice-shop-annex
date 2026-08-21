/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE inventory (sku TEXT NOT NULL, warehouse_id INTEGER NOT NULL, quantity INTEGER NOT NULL, PRIMARY KEY (sku, warehouse_id)); CREATE TABLE restocks (id INTEGER PRIMARY KEY, sku TEXT NOT NULL, warehouse_id INTEGER NOT NULL, quantity INTEGER NOT NULL, requested_at TEXT NOT NULL)')
db.prepare('INSERT INTO inventory VALUES (?, ?, ?)').run('JUICE-APPLE-001', 1, 25)
const validSku = (value: unknown): string | undefined => typeof value === 'string' && /^[A-Z0-9]+(?:-[A-Z0-9]+){1,4}$/.test(value) && value.length <= 40 ? value : undefined
const warehouse = (value: unknown): number | undefined => { const id = Number(value); return Number.isSafeInteger(id) && id >= 1 && id <= 100 ? id : undefined }

export function checkStock () {
  return (req: Request, res: Response) => {
    const sku = validSku(req.params.sku); if (!sku) return res.status(400).json({ error: 'Invalid SKU' })
    const stock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory WHERE sku = ?').get(sku) as { quantity: number }
    return res.json({ sku, quantity: stock.quantity, available: stock.quantity > 0 })
  }
}
export function getStockLevels () {
  return (_req: Request, res: Response) => {
    const levels = db.prepare('SELECT sku, warehouse_id AS warehouseId, quantity FROM inventory ORDER BY sku, warehouse_id').all()
    return res.json({ levels })
  }
}
export function requestRestock () {
  return (req: Request, res: Response) => {
    const sku = validSku(req.body?.sku); const warehouseId = warehouse(req.body?.warehouseId); const quantity = Number(req.body?.quantity)
    if (!sku || !warehouseId || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 10000) return res.status(400).json({ error: 'Invalid restock request' })
    const exists = db.prepare('SELECT 1 FROM inventory WHERE warehouse_id = ? LIMIT 1').get(warehouseId)
    if (!exists) return res.status(400).json({ error: 'Unknown warehouse' })
    const result = db.prepare('INSERT INTO restocks (sku, warehouse_id, quantity, requested_at) VALUES (?, ?, ?, ?)').run(sku, warehouseId, quantity, new Date().toISOString())
    return res.status(201).json({ id: Number(result.lastInsertRowid), sku, warehouseId, quantity })
  }
}
export function getRestockHistory () {
  return (req: Request, res: Response) => {
    const sku = validSku(req.params.sku); if (!sku) return res.status(400).json({ error: 'Invalid SKU' })
    const requests = db.prepare('SELECT id, warehouse_id AS warehouseId, quantity, requested_at AS requestedAt FROM restocks WHERE sku = ? ORDER BY id DESC').all(sku)
    return res.json({ sku, requests })
  }
}
export function checkAvailability () {
  return (req: Request, res: Response) => {
    const skus = req.body?.skus
    if (!Array.isArray(skus) || skus.length === 0 || skus.length > 50 || !skus.every(validSku)) return res.status(400).json({ error: 'Invalid SKU list' })
    const results = skus.map(sku => {
      const stock = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory WHERE sku = ?').get(sku) as { quantity: number }
      return { sku, quantity: stock.quantity, available: stock.quantity > 0 }
    })
    return res.json({ items: results })
  }
}
