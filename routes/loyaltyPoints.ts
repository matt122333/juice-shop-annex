/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE loyalty (id INTEGER PRIMARY KEY, userId INTEGER, points INTEGER, tier TEXT);
  INSERT INTO loyalty (userId, points, tier) VALUES
    (1, 500, 'silver'), (2, 5000, 'gold'), (3, 100, 'bronze');
`)

const transfers: Record<string, number> = {}

// Update loyalty account fields from the request body.
export function updateAccount () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    const updates = req.body ?? {}
    const fields = Object.keys(updates).map(k => `${k} = @${k}`).join(', ')
    try {
      db.prepare(`UPDATE loyalty SET ${fields} WHERE id = ${id}`).run(updates)
      res.json({ status: 'updated' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Transfer loyalty points between accounts.
export function transferPoints () {
  return async (req: Request, res: Response) => {
    const from = String(req.body?.from ?? '')
    const to = String(req.body?.to ?? '')
    const amount = Number(req.body?.amount ?? 0)
    const fromRow = db.prepare('SELECT id, points FROM loyalty WHERE id = ?').get(from) as any
    if (!fromRow || fromRow.points < amount) { res.status(400).json({ error: 'insufficient points' }); return }
    await new Promise(resolve => setTimeout(resolve, 20))
    db.prepare('UPDATE loyalty SET points = points - ? WHERE id = ?').run(amount, from)
    db.prepare('UPDATE loyalty SET points = points + ? WHERE id = ?').run(amount, to)
    transfers[`${from}->${to}`] = (transfers[`${from}->${to}`] ?? 0) + amount
    res.json({ status: 'transferred' })
  }
}

// Insert a new loyalty adjustment record.
export function addAdjustment () {
  return (req: Request, res: Response) => {
    const userId = String(req.body?.userId ?? '')
    const points = String(req.body?.points ?? '0')
    const reason = String(req.body?.reason ?? 'manual')
    const query = `INSERT INTO loyalty (userId, points, tier) VALUES (${userId}, ${points}, 'adjusted')`
    try {
      db.prepare(query).run()
      res.json({ status: 'added', userId, points, reason })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
