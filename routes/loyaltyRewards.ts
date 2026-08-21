/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE loyalty (userId INTEGER PRIMARY KEY, points INTEGER NOT NULL);
  CREATE TABLE rewards (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cost INTEGER NOT NULL, active INTEGER NOT NULL);
  CREATE TABLE redemptions (id INTEGER PRIMARY KEY, userId INTEGER, rewardId INTEGER, points INTEGER, createdAt TEXT);
  INSERT INTO loyalty VALUES (1, 500), (2, 300), (3, 100);
  INSERT INTO rewards VALUES (1, 'Free Shipping', 100, 1), (2, 'Ten Percent Discount', 250, 1);
`)

const validId = (value: unknown): number | undefined => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Number(value) : undefined

export function getPointsBalance () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const balance = db.prepare('SELECT userId, points FROM loyalty WHERE userId = ?').get(userId)
    return balance ? res.json({ balance }) : res.status(404).json({ error: 'account not found' })
  }
}

export function listRewardsCatalog () {
  return (_req: Request, res: Response) => {
    const rewards = db.prepare('SELECT id, name, cost FROM rewards WHERE active = ? ORDER BY cost').all(1)
    return res.json({ rewards })
  }
}

export function redeemReward () {
  return (req: Request, res: Response) => {
    const userId = validId(req.body?.userId)
    const rewardId = validId(req.body?.rewardId)
    if (userId === undefined || rewardId === undefined) return res.status(400).json({ error: 'valid user and reward are required' })
    const outcome = db.transaction(() => {
      const account = db.prepare('SELECT points FROM loyalty WHERE userId = ?').get(userId) as { points: number } | undefined
      const reward = db.prepare('SELECT cost FROM rewards WHERE id = ? AND active = ?').get(rewardId, 1) as { cost: number } | undefined
      if (!account || !reward) return 'missing'
      if (account.points < reward.cost) return 'insufficient'
      db.prepare('UPDATE loyalty SET points = points - ? WHERE userId = ?').run(reward.cost, userId)
      db.prepare('INSERT INTO redemptions (userId, rewardId, points, createdAt) VALUES (?, ?, ?, ?)').run(userId, rewardId, reward.cost, new Date().toISOString())
      return 'redeemed'
    })()
    return outcome === 'redeemed' ? res.status(201).json({ status: outcome }) : res.status(outcome === 'missing' ? 404 : 409).json({ error: outcome === 'missing' ? 'account or reward not found' : 'insufficient points' })
  }
}

export function getRewardHistory () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const history = db.prepare('SELECT r.id, w.name, r.points, r.createdAt FROM redemptions r JOIN rewards w ON w.id = r.rewardId WHERE r.userId = ? ORDER BY r.id DESC').all(userId)
    return res.json({ history })
  }
}

export function transferPoints () {
  return (req: Request, res: Response) => {
    const fromUserId = validId(req.body?.fromUserId)
    const toUserId = validId(req.body?.toUserId)
    const amount = validId(req.body?.amount)
    if (fromUserId === undefined || toUserId === undefined || amount === undefined || fromUserId === toUserId) return res.status(400).json({ error: 'valid, distinct users and positive amount are required' })
    const outcome = db.transaction(() => {
      const from = db.prepare('SELECT points FROM loyalty WHERE userId = ?').get(fromUserId) as { points: number } | undefined
      const to = db.prepare('SELECT userId FROM loyalty WHERE userId = ?').get(toUserId)
      if (!from || !to) return 'missing'
      if (from.points < amount) return 'insufficient'
      db.prepare('UPDATE loyalty SET points = points - ? WHERE userId = ?').run(amount, fromUserId)
      db.prepare('UPDATE loyalty SET points = points + ? WHERE userId = ?').run(amount, toUserId)
      return 'transferred'
    })()
    return outcome === 'transferred' ? res.json({ status: outcome }) : res.status(outcome === 'missing' ? 404 : 409).json({ error: outcome === 'missing' ? 'account not found' : 'insufficient points' })
  }
}
