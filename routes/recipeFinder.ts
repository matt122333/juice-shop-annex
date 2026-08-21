/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE recipes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, ingredients TEXT NOT NULL, instructions TEXT NOT NULL, calories INTEGER, ratingTotal INTEGER DEFAULT 0, ratingCount INTEGER DEFAULT 0);
  CREATE TABLE suggestions (id INTEGER PRIMARY KEY, name TEXT, ingredients TEXT, instructions TEXT);
  INSERT INTO recipes VALUES (1, 'Apple Oat Bowl', 'apple,oats,cinnamon', 'Combine ingredients and serve.', 340, 8, 2);
  INSERT INTO recipes VALUES (2, 'Berry Smoothie', 'berries,yogurt,honey', 'Blend until smooth.', 220, 5, 1);
`)

const validId = (value: unknown): number | undefined => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Number(value) : undefined
const safeText = (value: unknown, maximum: number): string | undefined => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum ? value.trim() : undefined

export function searchRecipes () {
  return (req: Request, res: Response) => {
    const query = safeText(req.query.q, 80)
    if (!query) return res.status(400).json({ error: 'search query is required' })
    const recipes = db.prepare('SELECT id, name, ingredients, calories FROM recipes WHERE lower(ingredients) LIKE lower(?) ORDER BY name').all(`%${query}%`)
    return res.json({ recipes })
  }
}

export function getRecipe () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    if (id === undefined) return res.status(400).json({ error: 'invalid recipe id' })
    const recipe = db.prepare('SELECT id, name, ingredients, instructions, calories FROM recipes WHERE id = ?').get(id)
    return recipe ? res.json({ recipe }) : res.status(404).json({ error: 'recipe not found' })
  }
}

export function getNutritionInfo () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    if (id === undefined) return res.status(400).json({ error: 'invalid recipe id' })
    const nutrition = db.prepare('SELECT id, name, calories FROM recipes WHERE id = ?').get(id)
    return nutrition ? res.json({ nutrition }) : res.status(404).json({ error: 'recipe not found' })
  }
}

export function rateRecipe () {
  return (req: Request, res: Response) => {
    const id = validId(req.params.id)
    const rating = Number(req.body?.rating)
    if (id === undefined || !Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be an integer from 1 to 5' })
    const result = db.prepare('UPDATE recipes SET ratingTotal = ratingTotal + ?, ratingCount = ratingCount + 1 WHERE id = ?').run(rating, id)
    return result.changes ? res.json({ status: 'rated' }) : res.status(404).json({ error: 'recipe not found' })
  }
}

export function suggestRecipe () {
  return (req: Request, res: Response) => {
    const name = safeText(req.body?.name, 100)
    const ingredients = safeText(req.body?.ingredients, 1000)
    const instructions = safeText(req.body?.instructions, 4000)
    if (!name || !ingredients || !instructions) return res.status(400).json({ error: 'name, ingredients, and instructions are required' })
    try {
      const result = db.prepare('INSERT INTO suggestions (name, ingredients, instructions) VALUES (?, ?, ?)').run(name, ingredients, instructions)
      return res.status(201).json({ status: 'received', suggestionId: result.lastInsertRowid })
    } catch {
      return res.status(500).json({ error: 'Unable to save suggestion' })
    }
  }
}
