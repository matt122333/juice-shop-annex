/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE reviews (id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, user_id INTEGER NOT NULL, rating INTEGER NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL)')

const numericId = (value: unknown): number | undefined => {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
}
const currentUser = (req: Request): number | undefined => numericId((req as any).user?.id)
const cleanText = (value: unknown, limit: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/[<>]/g, '').trim()
  return text.length > 0 && text.length <= limit ? text : undefined
}

export function getReviews () {
  return (req: Request, res: Response) => {
    const productId = numericId(req.params.productId)
    if (!productId) return res.status(400).json({ error: 'Invalid product id' })
    const reviews = db.prepare('SELECT id, rating, comment, created_at AS createdAt FROM reviews WHERE product_id = ? ORDER BY id DESC').all(productId)
    return res.json({ productId, reviews })
  }
}

export function addReview () {
  return (req: Request, res: Response) => {
    const productId = numericId(req.params.productId)
    const userId = currentUser(req)
    const rating = numericId(req.body?.rating)
    const comment = cleanText(req.body?.comment, 1000)
    if (!productId || !userId || !rating || rating > 5 || !comment) return res.status(400).json({ error: 'Invalid review data' })
    const result = db.prepare('INSERT INTO reviews (product_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)').run(productId, userId, rating, comment, new Date().toISOString())
    return res.status(201).json({ id: Number(result.lastInsertRowid), productId, rating, comment })
  }
}

export function editReview () {
  return (req: Request, res: Response) => {
    const productId = numericId(req.params.productId); const reviewId = numericId(req.params.reviewId); const userId = currentUser(req)
    const rating = numericId(req.body?.rating); const comment = cleanText(req.body?.comment, 1000)
    if (!productId || !reviewId || !userId || !rating || rating > 5 || !comment) return res.status(400).json({ error: 'Invalid review data' })
    const result = db.prepare('UPDATE reviews SET rating = ?, comment = ? WHERE id = ? AND product_id = ? AND user_id = ?').run(rating, comment, reviewId, productId, userId)
    return result.changes === 1 ? res.json({ id: reviewId, rating, comment }) : res.status(404).json({ error: 'Review not found' })
  }
}

export function deleteReview () {
  return (req: Request, res: Response) => {
    const productId = numericId(req.params.productId); const reviewId = numericId(req.params.reviewId); const userId = currentUser(req)
    if (!productId || !reviewId || !userId) return res.status(400).json({ error: 'Invalid review identifier' })
    const result = db.prepare('DELETE FROM reviews WHERE id = ? AND product_id = ? AND user_id = ?').run(reviewId, productId, userId)
    return result.changes === 1 ? res.status(204).send() : res.status(404).json({ error: 'Review not found' })
  }
}

export function getReviewStats () {
  return (req: Request, res: Response) => {
    const productId = numericId(req.params.productId)
    if (!productId) return res.status(400).json({ error: 'Invalid product id' })
    const stats = db.prepare('SELECT COUNT(*) AS count, ROUND(AVG(rating), 2) AS averageRating FROM reviews WHERE product_id = ?').get(productId) as { count: number, averageRating: number | null }
    return res.json({ productId, count: stats.count, averageRating: stats.averageRating })
  }
}
