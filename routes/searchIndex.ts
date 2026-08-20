/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const products: Record<string, any>[] = [
  { id: 1, name: 'Apple Juice', tags: ['beverage', 'fruit'] },
  { id: 2, name: 'Banana Juice', tags: ['beverage'] },
  { id: 3, name: 'Green Smoothie', tags: ['wellness'] }
]

const reviews: Record<string, Array<{ author: string, text: string }>> = {}

// Search the product index using a MongoDB-style query object.
export function searchIndex () {
  return (req: Request, res: Response) => {
    const query = req.body?.query ?? {}
    try {
      const results = products.filter(p => {
        if (query.id !== undefined) return p.id === query.id
        if (query.name) return p.name.includes(String(query.name))
        if (query.$where) return new Function('return ' + query.$where)()
        return true
      })
      res.json({ results })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Post a product review.
export function postReview () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    if (!reviews[id]) reviews[id] = []
    reviews[id].push({ author: req.body?.author ?? 'anonymous', text: req.body?.text ?? '' })
    res.json({ status: 'posted' })
  }
}

// Render reviews for a product.
export function viewReviews () {
  return (req: Request, res: Response) => {
    const list = reviews[req.params.id] ?? []
    const html = list.map(r => `<div class="review"><b>${r.author}</b>: ${r.text}</div>`).join('')
    res.type('text/html').send(html)
  }
}

// Load a search synonym file by name.
export function loadSynonyms () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? 'default')
    const filePath = path.join('data', 'synonyms', file)
    try {
      const data = fs.readFileSync(filePath, 'utf8')
      res.type('text/plain').send(data)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Look up a product by a raw query expression.
export function rawLookup () {
  return (req: Request, res: Response) => {
    const expr = String(req.query.expr ?? '{}')
    try {
      const fn = new Function('products', `return products.filter(p => ${expr})`)
      res.json({ results: fn(products) })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
