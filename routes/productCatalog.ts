/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, tag TEXT, price REAL);
  CREATE TABLE members (id INTEGER PRIMARY KEY, email TEXT, password TEXT, tier TEXT);
  INSERT INTO products (name, tag, price) VALUES
    ('Apple Juice','beverage',1.99),('Banana Juice','beverage',1.99),('Green Smoothie','wellness',2.49);
  INSERT INTO members (email, password, tier) VALUES
    ('loyalty@juice-sh.op','Winter2024Loyalty!','gold'),
    ('regular@juice-sh.op','shopper2022','silver');
`)

const questions: Record<string, Array<{ author: string, text: string }>> = {}

// Return products matching a promotional tag.
export function productsByTag () {
  return (req: Request, res: Response) => {
    const tag = String(req.query.tag ?? '')
    const query = `SELECT id, name, price FROM products WHERE tag = '${tag}'`
    try {
      res.json({ status: 'success', data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ status: 'error', error: err.message })
    }
  }
}

// Catalog listing with a configurable sort order.
export function catalogListing () {
  return (req: Request, res: Response) => {
    const sortBy = String(req.query.sortBy ?? 'name')
    const query = `SELECT id, name, price FROM products ORDER BY ${sortBy}`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Post a customer question about a product.
export function postProductQuestion () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    if (!questions[id]) questions[id] = []
    questions[id].push({ author: req.body?.author ?? 'anonymous', text: req.body?.text ?? '' })
    res.json({ status: 'posted', count: questions[id].length })
  }
}

// Render the questions posted for a product.
export function listProductQuestions () {
  return (req: Request, res: Response) => {
    const list = questions[req.params.id] ?? []
    const rendered = list.map(q => `<li><span class="author">${q.author}</span>: ${q.text}</li>`).join('')
    res.type('text/html').send(`<ul class="product-questions">${rendered}</ul>`)
  }
}
