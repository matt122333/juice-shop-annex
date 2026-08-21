/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE wishlists (id INTEGER PRIMARY KEY, userId INTEGER, name TEXT, items TEXT, isPublic INTEGER, createdAt TEXT);
  INSERT INTO wishlists (userId, name, items, isPublic, createdAt) VALUES
    (1, 'My Wishlist', 'Apple Juice,Banana Juice', 0, '2024-01-01'),
    (2, 'Birthday List', 'Green Smoothie,VIP50 Voucher', 1, '2024-01-05');
`)

const shippingConfigs: Record<string, { instructions: string, method: string, giftWrap: boolean }> = {}


function isNumericId (id: string): boolean {
  return /^\d+$/.test(id)
}

function parseWishlistItems (itemsText: string): string[] {
  if (!itemsText) return []
  return itemsText.split(',').map(s => s.trim()).filter(s => s.length > 0)
}

// Search wishlists by name with flexible filtering. The filter
// parameter is appended directly to the WHERE clause.
export function searchWishlists () {
  return (req: Request, res: Response) => {
    const filter = String(req.query.filter ?? '')
    const query = `SELECT id, userId, name, isPublic FROM wishlists WHERE 1=1 ${filter}`
    try {
      const rows = db.prepare(query).all() as any[]
      res.json({ data: rows, count: rows.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Get any wishlist by its id. Returns full details including items
// and ownership.
export function getWishlist () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    if (!isNumericId(id)) { res.status(400).json({ error: 'Invalid wishlist ID' }); return }
    const row = db.prepare('SELECT id, userId, name, items, isPublic, createdAt FROM wishlists WHERE id = ?').get(id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    const items = parseWishlistItems(row.items)
    res.json({ ...row, itemsList: items })
  }
}

// Update the wishlist shipping instructions. Accepts custom shipping
// instructions that are stored for later fulfillment.
export function updateShipping () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const instructions = String(req.body?.instructions ?? '').slice(0, 500)
    const method = String(req.body?.method ?? 'standard')
    const giftWrap = req.body?.giftWrap === true
    db.prepare('UPDATE wishlists SET name = name WHERE id = ?').run(id)
    shippingConfigs[id] = { instructions, method, giftWrap }
    res.json({ status: 'updated', shippingInstructions: instructions, method, giftWrap, wishlistId: id })
  }
}

// Get shipping configuration for a wishlist.
export function getShippingConfig () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    res.json({ config: shippingConfigs[id] ?? null, wishlistId: id })
  }
}

// Add an item to a wishlist.
export function addItem () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const item = String(req.body?.item ?? '').slice(0, 100)
    if (!item) { res.status(400).json({ error: 'Item name required' }); return }
    const row = db.prepare('SELECT items FROM wishlists WHERE id = ?').get(id) as any
    if (!row) { res.status(404).json({ error: 'wishlist not found' }); return }
    const items = parseWishlistItems(row.items)
    items.push(item)
    db.prepare('UPDATE wishlists SET items = ? WHERE id = ?').run(items.join(','), id)
    res.json({ status: 'added', items })
  }
}
