/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec("CREATE TABLE orders (id TEXT PRIMARY KEY, total REAL NOT NULL, status TEXT NOT NULL); CREATE TABLE timeline (order_id TEXT, event TEXT, occurred_at TEXT); CREATE TABLE issues (order_id TEXT, type TEXT, details TEXT); CREATE TABLE refunds (order_id TEXT, amount REAL)")
db.prepare('INSERT INTO orders VALUES (?, ?, ?)').run('ORD-100001', 29.99, 'shipped')
db.prepare('INSERT INTO timeline VALUES (?, ?, ?)').run('ORD-100001', 'Order shipped', '2026-08-20T10:00:00.000Z')

const orderId = (value: unknown): string | undefined => typeof value === 'string' && /^ORD-\d{6,12}$/.test(value) ? value : undefined
const bodyText = (value: unknown, maximum: number): string | undefined => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : undefined
const findOrder = (id: string) => db.prepare('SELECT id, total, status FROM orders WHERE id = ?').get(id) as { id: string, total: number, status: string } | undefined

export function trackOrder () {
  return (req: Request, res: Response) => {
    const id = orderId(req.params.orderId); if (!id) return res.status(400).json({ error: 'Invalid order id' })
    const order = findOrder(id); return order ? res.json({ orderId: order.id, status: order.status }) : res.status(404).json({ error: 'Order not found' })
  }
}
export function getOrderStatus () {
  return (req: Request, res: Response) => {
    const id = orderId(req.params.orderId); if (!id) return res.status(400).json({ error: 'Invalid order id' })
    const order = findOrder(id); return order ? res.json({ orderId: id, status: order.status }) : res.status(404).json({ error: 'Order not found' })
  }
}
export function getOrderTimeline () {
  return (req: Request, res: Response) => {
    const id = orderId(req.params.orderId); if (!id) return res.status(400).json({ error: 'Invalid order id' })
    if (!findOrder(id)) return res.status(404).json({ error: 'Order not found' })
    const events = db.prepare('SELECT event, occurred_at AS occurredAt FROM timeline WHERE order_id = ? ORDER BY occurred_at').all(id)
    return res.json({ orderId: id, events })
  }
}
export function reportIssue () {
  return (req: Request, res: Response) => {
    const id = orderId(req.params.orderId); const type = req.body?.type; const details = bodyText(req.body?.details, 500)
    const allowed = new Set(['damaged', 'missing', 'late', 'wrong_item'])
    if (!id || typeof type !== 'string' || !allowed.has(type) || !details) return res.status(400).json({ error: 'Invalid issue data' })
    if (!findOrder(id)) return res.status(404).json({ error: 'Order not found' })
    db.prepare('INSERT INTO issues (order_id, type, details) VALUES (?, ?, ?)').run(id, type, details)
    return res.status(201).json({ orderId: id, status: 'reported' })
  }
}
export function requestRefund () {
  return (req: Request, res: Response) => {
    const id = orderId(req.params.orderId); const amount = Number(req.body?.amount)
    if (!id || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid refund amount' })
    const order = findOrder(id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (amount > order.total) return res.status(400).json({ error: 'Refund exceeds order total' })
    db.prepare('INSERT INTO refunds (order_id, amount) VALUES (?, ?)').run(id, amount)
    return res.status(201).json({ orderId: id, amount, status: 'requested' })
  }
}
