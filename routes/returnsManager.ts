/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE returns (id INTEGER PRIMARY KEY AUTOINCREMENT, orderId INTEGER NOT NULL, userId INTEGER NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL, refundAmount REAL);
  INSERT INTO returns (orderId,userId,reason,status) VALUES (1001,1,'damaged','pending');`)
const reasons = new Set(['damaged', 'wrong_item', 'not_as_described', 'other'])
const isAdmin = (req: Request) => req.get('x-user-role') === 'admin'
const readId = (value: unknown): number | undefined => {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function createReturnRequest () {
  return (req: Request, res: Response): void => {
    const orderId = readId(req.body?.orderId)
    const userId = readId(req.get('x-user-id'))
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : ''
    if (orderId === undefined || userId === undefined || !reasons.has(reason)) { res.status(400).json({ error: 'Invalid return request.' }); return }
    const result = db.prepare('INSERT INTO returns (orderId, userId, reason, status) VALUES (?, ?, ?, ?)').run(orderId, userId, reason, 'pending')
    res.status(201).json({ returnId: Number(result.lastInsertRowid), status: 'pending' })
  }
}

export function getReturnStatus () {
  return (req: Request, res: Response): void => {
    const returnId = readId(req.params.returnId)
    if (returnId === undefined) { res.status(400).json({ error: 'Invalid return ID.' }); return }
    const item = db.prepare('SELECT id, orderId, reason, status, refundAmount FROM returns WHERE id = ?').get(returnId)
    if (item === undefined) { res.status(404).json({ error: 'Return request not found.' }); return }
    res.status(200).json({ return: item })
  }
}

export function approveReturn () {
  return (req: Request, res: Response): void => {
    if (!isAdmin(req)) { res.status(403).json({ error: 'Administrator access required.' }); return }
    const returnId = readId(req.params.returnId)
    if (returnId === undefined) { res.status(400).json({ error: 'Invalid return ID.' }); return }
    const result = db.prepare('UPDATE returns SET status = ? WHERE id = ? AND status = ?').run('approved', returnId, 'pending')
    if (result.changes !== 1) { res.status(409).json({ error: 'Return cannot be approved.' }); return }
    res.status(200).json({ status: 'approved' })
  }
}

export function processRefund () {
  return (req: Request, res: Response): void => {
    if (!isAdmin(req)) { res.status(403).json({ error: 'Administrator access required.' }); return }
    const returnId = readId(req.params.returnId)
    const amount = Number(req.body?.amount)
    if (returnId === undefined || !Number.isFinite(amount) || amount <= 0 || amount > 100000) { res.status(400).json({ error: 'Invalid refund details.' }); return }
    const result = db.prepare('UPDATE returns SET status = ?, refundAmount = ? WHERE id = ? AND status = ?').run('refunded', amount, returnId, 'approved')
    if (result.changes !== 1) { res.status(409).json({ error: 'Return is not eligible for refund.' }); return }
    res.status(200).json({ status: 'refunded', amount })
  }
}

export function getReturnHistory () {
  return (req: Request, res: Response): void => {
    const userId = readId(req.params.userId)
    if (userId === undefined) { res.status(400).json({ error: 'Invalid user ID.' }); return }
    const history = db.prepare('SELECT id, orderId, reason, status, refundAmount FROM returns WHERE userId = ? ORDER BY id DESC').all(userId)
    res.status(200).json({ history })
  }
}
