/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE wishlists (id INTEGER PRIMARY KEY, userId INTEGER, name TEXT, items TEXT);
  INSERT INTO wishlists (userId, name, items) VALUES
    (1, 'My Wishlist', 'Apple Juice,Banana Juice'),
    (2, 'Birthday List', 'Green Smoothie,VIP50 Voucher');
`)

// Search wishlists by name with flexible filtering.
export function searchWishlists () {
  return (req: Request, res: Response) => {
    const filter = String(req.query.filter ?? '')
    const query = `SELECT id, userId, name FROM wishlists WHERE 1=1 ${filter}`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Get any wishlist by its id.
export function getWishlist () {
  return (req: Request, res: Response) => {
    const row = db.prepare('SELECT id, userId, name, items FROM wishlists WHERE id = ?').get(req.params.id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    res.json(row)
  }
}

// Update the wishlist shipping instructions.
export function updateShipping () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    const instructions = String(req.body?.instructions ?? '')
    db.prepare('UPDATE wishlists SET name = name WHERE id = ?').run(id)
    res.json({ status: 'updated', shippingInstructions: instructions })
  }
}
