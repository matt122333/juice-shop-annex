/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE stores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, zip TEXT NOT NULL, address TEXT NOT NULL, hours TEXT NOT NULL);
  CREATE TABLE inventory (storeId INTEGER, productId INTEGER, productName TEXT, available INTEGER, PRIMARY KEY (storeId, productId));
  CREATE TABLE reservations (id INTEGER PRIMARY KEY, storeId INTEGER, productId INTEGER, quantity INTEGER);
  INSERT INTO stores VALUES (1, 'Downtown Market', '12345', '10 Main Street', 'Mon-Sat 09:00-20:00');
  INSERT INTO stores VALUES (2, 'Lakeside Market', '12345', '42 Lake Road', 'Mon-Sun 10:00-18:00');
  INSERT INTO inventory VALUES (1, 101, 'Apple Juice', 25), (1, 102, 'Oat Cookies', 12), (2, 101, 'Apple Juice', 8);
`)

const validId = (value: unknown): number | undefined => {
  const text = String(value ?? '')
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : undefined
}

export function findStores () {
  return (req: Request, res: Response) => {
    const zip = String(req.query.zip ?? '')
    if (!/^\d{5}$/.test(zip)) return res.status(400).json({ error: 'zip must be five digits' })
    try {
      const stores = db.prepare('SELECT id, name, address FROM stores WHERE zip = ? ORDER BY name').all(zip)
      return res.json({ stores })
    } catch {
      return res.status(500).json({ error: 'Unable to find stores' })
    }
  }
}

export function getStoreDetails () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    if (id === undefined) return res.status(400).json({ error: 'invalid store id' })
    const store = db.prepare('SELECT id, name, zip, address FROM stores WHERE id = ?').get(id)
    return store ? res.json({ store }) : res.status(404).json({ error: 'store not found' })
  }
}

export function listStoreInventory () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    if (id === undefined) return res.status(400).json({ error: 'invalid store id' })
    const store = db.prepare('SELECT id FROM stores WHERE id = ?').get(id)
    if (!store) return res.status(404).json({ error: 'store not found' })
    const inventory = db.prepare('SELECT productId, productName, available FROM inventory WHERE storeId = ?').all(id)
    return res.json({ inventory })
  }
}

export function getStoreHours () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    if (id === undefined) return res.status(400).json({ error: 'invalid store id' })
    const store = db.prepare('SELECT name, hours FROM stores WHERE id = ?').get(id)
    return store ? res.json({ store }) : res.status(404).json({ error: 'store not found' })
  }
}

export function reserveProduct () {
  return (req: Request, res: Response) => {
    const storeId = validId(req.params.id)
    const productId = validId(req.body?.productId)
    const quantity = validId(req.body?.quantity)
    if (storeId === undefined || productId === undefined || quantity === undefined) return res.status(400).json({ error: 'valid product and quantity are required' })
    try {
      const reserve = db.transaction(() => {
        const item = db.prepare('SELECT available FROM inventory WHERE storeId = ? AND productId = ?').get(storeId, productId) as { available: number } | undefined
        if (!item) return 'missing'
        if (item.available < quantity) return 'unavailable'
        db.prepare('UPDATE inventory SET available = available - ? WHERE storeId = ? AND productId = ?').run(quantity, storeId, productId)
        db.prepare('INSERT INTO reservations (storeId, productId, quantity) VALUES (?, ?, ?)').run(storeId, productId, quantity)
        return 'reserved'
      })()
      if (reserve !== 'reserved') return res.status(reserve === 'missing' ? 404 : 409).json({ error: reserve === 'missing' ? 'product not stocked' : 'insufficient inventory' })
      return res.status(201).json({ status: 'reserved', storeId, productId, quantity })
    } catch {
      return res.status(500).json({ error: 'Unable to reserve product' })
    }
  }
}
