/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
import { randomBytes } from 'crypto'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE wishlists (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, share_token TEXT UNIQUE); CREATE TABLE wishlist_items (id INTEGER PRIMARY KEY, wishlist_id INTEGER NOT NULL, product_id INTEGER NOT NULL, UNIQUE(wishlist_id, product_id))')
const id = (value: unknown): number | undefined => { const result = Number(value); return Number.isSafeInteger(result) && result > 0 ? result : undefined }
const userId = (req: Request): number | undefined => id((req as any).user?.id)
const name = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[<>]/g, '').trim()
  return cleaned.length > 0 && cleaned.length <= 80 ? cleaned : undefined
}
const owns = (wishlistId: number, ownerId: number): boolean => Boolean(db.prepare('SELECT 1 FROM wishlists WHERE id = ? AND user_id = ?').get(wishlistId, ownerId))

export function createWishlist () {
  return (req: Request, res: Response) => {
    const ownerId = userId(req); const wishlistName = name(req.body?.name)
    if (!ownerId || !wishlistName) return res.status(400).json({ error: 'Invalid wishlist data' })
    const result = db.prepare('INSERT INTO wishlists (user_id, name) VALUES (?, ?)').run(ownerId, wishlistName)
    return res.status(201).json({ id: Number(result.lastInsertRowid), name: wishlistName })
  }
}
export function getWishlist () {
  return (req: Request, res: Response) => {
    const wishlistId = id(req.params.id); const ownerId = userId(req)
    if (!wishlistId || !ownerId) return res.status(400).json({ error: 'Invalid wishlist identifier' })
    const wishlist = db.prepare('SELECT id, name, share_token AS shareToken FROM wishlists WHERE id = ? AND user_id = ?').get(wishlistId, ownerId)
    if (!wishlist) return res.status(404).json({ error: 'Wishlist not found' })
    const items = db.prepare('SELECT id, product_id AS productId FROM wishlist_items WHERE wishlist_id = ?').all(wishlistId)
    return res.json({ wishlist, items })
  }
}
export function addItemToWishlist () {
  return (req: Request, res: Response) => {
    const wishlistId = id(req.params.id); const ownerId = userId(req); const productId = id(req.body?.productId)
    if (!wishlistId || !ownerId || !productId) return res.status(400).json({ error: 'Invalid item data' })
    if (!owns(wishlistId, ownerId)) return res.status(404).json({ error: 'Wishlist not found' })
    try { const result = db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id) VALUES (?, ?)').run(wishlistId, productId); return res.status(201).json({ id: Number(result.lastInsertRowid), productId }) } catch { return res.status(409).json({ error: 'Item already exists' }) }
  }
}
export function removeItemFromWishlist () {
  return (req: Request, res: Response) => {
    const wishlistId = id(req.params.id); const itemId = id(req.params.itemId); const ownerId = userId(req)
    if (!wishlistId || !itemId || !ownerId) return res.status(400).json({ error: 'Invalid item identifier' })
    if (!owns(wishlistId, ownerId)) return res.status(404).json({ error: 'Wishlist not found' })
    const result = db.prepare('DELETE FROM wishlist_items WHERE id = ? AND wishlist_id = ?').run(itemId, wishlistId)
    return result.changes === 1 ? res.status(204).send() : res.status(404).json({ error: 'Item not found' })
  }
}
export function shareWishlist () {
  return (req: Request, res: Response) => {
    const wishlistId = id(req.params.id); const ownerId = userId(req)
    if (!wishlistId || !ownerId || !owns(wishlistId, ownerId)) return res.status(404).json({ error: 'Wishlist not found' })
    const token = randomBytes(24).toString('hex')
    db.prepare('UPDATE wishlists SET share_token = ? WHERE id = ? AND user_id = ?').run(token, wishlistId, ownerId)
    return res.json({ shareToken: token })
  }
}
