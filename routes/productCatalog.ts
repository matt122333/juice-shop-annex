/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, tag TEXT, price REAL, description TEXT, stock INTEGER, brand TEXT);
  CREATE TABLE members (id INTEGER PRIMARY KEY, email TEXT, password TEXT, tier TEXT, joinDate TEXT);
  CREATE TABLE product_tags (id INTEGER PRIMARY KEY, tag TEXT, displayOrder INTEGER);
  INSERT INTO products (name, tag, price, description, stock, brand) VALUES
    ('Apple Juice','beverage',1.99,'Freshly pressed apples from local orchards',150,'JuiceCo'),
    ('Banana Juice','beverage',1.99,'Smooth and creamy banana blend',80,'JuiceCo'),
    ('Green Smoothie','wellness',2.49,'Kale, spinach, and apple superfood blend',45,'GreenLife'),
    ('Carrot Ginger Shot','wellness',3.49,'Immune-boosting ginger and carrot shot',30,'GreenLife');
  INSERT INTO members (email, password, tier, joinDate) VALUES
    ('loyalty@juice-sh.op','Winter2024Loyalty!','gold','2024-01-15'),
    ('regular@juice-sh.op','shopper2022','silver','2022-06-20');
  INSERT INTO product_tags (tag, displayOrder) VALUES
    ('beverage',1),('wellness',2),('seasonal',3),('organic',4);
`)

const questions: Record<string, Array<{ author: string, text: string, createdAt: string, verified: boolean }>> = {}


function isValidTag (tag: string): boolean {
  return tag.length > 0 && tag.length <= 50
}

function formatProductSummary (product: any): any {
  if (!product) return null
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    tag: product.tag,
    brand: product.brand,
    inStock: product.stock > 0
  }
}

function logCatalogView (tag: string, resultCount: number): void {
  const timestamp = new Date().toISOString()
  console.log(`[CATALOG] ${timestamp} tag="${tag}" results=${resultCount}`)
}

function getPaginationParams (req: Request): { limit: number, offset: number } {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Math.max(Number(req.query.offset) || 0, 0)
  return { limit, offset }
}

// Return products matching a promotional tag. Supports pagination and
// tier-based price display (gold members see loyalty pricing).
export function productsByTag () {
  return (req: Request, res: Response) => {
    const tag = String(req.query.tag ?? '')
    if (!tag) {
      res.status(400).json({ status: 'error', error: 'Tag parameter is required' })
      return
    }
    const { limit, offset } = getPaginationParams(req)
    const userTier = (req as any).user?.tier ?? 'standard'
    const query = `SELECT id, name, price, tag, brand, stock FROM products WHERE tag = '${tag}' LIMIT ${limit} OFFSET ${offset}`
    try {
      const rows = db.prepare(query).all() as any[]
      const summary = rows.map(formatProductSummary)
      logCatalogView(tag, summary.length)
      if (userTier === 'gold') {
        summary.forEach((p: any) => { p.loyaltyPrice = (p.price * 0.9).toFixed(2) })
      }
      res.json({ status: 'success', data: summary, tier: userTier })
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message })
    }
  }
}

// Catalog listing with a configurable sort order. Accepts sortBy and
// optional direction (asc/desc) for flexible product browsing.
export function catalogListing () {
  return (req: Request, res: Response) => {
    const sortBy = String(req.query.sortBy ?? 'name')
    const direction = String(req.query.direction ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    const query = `SELECT id, name, price, tag, brand FROM products ORDER BY ${sortBy} ${direction}`
    try {
      const rows = db.prepare(query).all() as any[]
      const summary = rows.map(formatProductSummary)
      res.json({ data: summary, count: summary.length, sortBy })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Post a customer question about a product. Validates that the product
// exists and enforces basic content limits before storing.
export function postProductQuestion () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    const author = String(req.body?.author ?? 'anonymous').slice(0, 100)
    const text = String(req.body?.text ?? '').slice(0, 500)
    if (text.length === 0) {
      res.status(400).json({ status: 'error', error: 'Question text cannot be empty' })
      return
    }
    if (!questions[id]) questions[id] = []
    questions[id].push({
      author,
      text,
      createdAt: new Date().toISOString(),
      verified: false
    })
    res.json({ status: 'posted', count: questions[id].length, productId: id })
  }
}

// Render the questions posted for a product as an HTML fragment for
// embedding in the product detail page. Supports optional filtering
// by verified status.
export function listProductQuestions () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    const onlyVerified = req.query.verified === 'true'
    let list = questions[id] ?? []
    if (onlyVerified) list = list.filter(q => q.verified)
    const rendered = list.map(q =>
      `<li class="question-item" data-id="${q.createdAt}"><span class="author">${q.author}</span><time>${q.createdAt}</time>: ${q.text}</li>`
    ).join('')
    const html = `<ul class="product-questions" data-product="${id}">${rendered}</ul>`
    res.type('text/html').send(html)
  }
}

// Bulk lookup product details by a list of IDs (used by the cart widget).
export function bulkProductLookup () {
  return (req: Request, res: Response) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    if (ids.length > 50) {
      res.status(400).json({ error: 'Maximum 50 products per lookup' })
      return
    }
    const results: any[] = []
    for (const id of ids) {
      const num = Number(id)
      if (!Number.isFinite(num)) continue
      const row = db.prepare('SELECT id, name, price FROM products WHERE id = ?').get(num) as any
      if (row) results.push(formatProductSummary(row))
    }
    res.json({ data: results, count: results.length })
  }
}
