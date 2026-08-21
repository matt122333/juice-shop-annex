/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec('CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0); CREATE TABLE preferences (user_id INTEGER PRIMARY KEY, email INTEGER NOT NULL DEFAULT 1, push INTEGER NOT NULL DEFAULT 1, sms INTEGER NOT NULL DEFAULT 0); CREATE TABLE subscriptions (user_id INTEGER NOT NULL, topic TEXT NOT NULL, UNIQUE(user_id, topic))')
const numeric = (value: unknown): number | undefined => { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined }
const allowedTopics = new Set(['orders', 'promotions', 'security'])
const owner = (req: Request): number | undefined => numeric((req as any).user?.id)
const isOwner = (req: Request, userId: number): boolean => owner(req) === userId

export function getNotifications () {
  return (req: Request, res: Response) => {
    const userId = numeric(req.params.userId); if (!userId || !isOwner(req, userId)) return res.status(403).json({ error: 'Access denied' })
    const notifications = db.prepare('SELECT id, message, read FROM notifications WHERE user_id = ? ORDER BY id DESC').all(userId)
    return res.json({ notifications })
  }
}
export function markAsRead () {
  return (req: Request, res: Response) => {
    const userId = numeric(req.params.userId); const notificationId = numeric(req.params.notifId)
    if (!userId || !notificationId || !isOwner(req, userId)) return res.status(403).json({ error: 'Access denied' })
    const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(notificationId, userId)
    return result.changes === 1 ? res.json({ id: notificationId, read: true }) : res.status(404).json({ error: 'Notification not found' })
  }
}
export function updateNotificationPrefs () {
  return (req: Request, res: Response) => {
    const userId = numeric(req.params.userId); const body = req.body as Record<string, unknown> | undefined
    if (!userId || !isOwner(req, userId) || !body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid preferences' })
    const fields = ['email', 'push', 'sms'] as const; const updates = fields.filter(field => typeof body[field] === 'boolean')
    if (updates.length === 0 || Object.keys(body).some(key => !fields.includes(key as typeof fields[number]))) return res.status(400).json({ error: 'Invalid preferences' })
    const existing = db.prepare('SELECT email, push, sms FROM preferences WHERE user_id = ?').get(userId) as { email: number, push: number, sms: number } | undefined
    const prefs = { email: existing?.email ?? 1, push: existing?.push ?? 1, sms: existing?.sms ?? 0 }
    for (const field of updates) prefs[field] = body[field] === true ? 1 : 0
    db.prepare('INSERT INTO preferences (user_id, email, push, sms) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, push = excluded.push, sms = excluded.sms').run(userId, prefs.email, prefs.push, prefs.sms)
    return res.json({ email: Boolean(prefs.email), push: Boolean(prefs.push), sms: Boolean(prefs.sms) })
  }
}
export function subscribeToTopic () {
  return (req: Request, res: Response) => {
    const userId = owner(req); const topic = req.body?.topic
    if (!userId || typeof topic !== 'string' || !allowedTopics.has(topic)) return res.status(400).json({ error: 'Invalid subscription' })
    try { db.prepare('INSERT INTO subscriptions (user_id, topic) VALUES (?, ?)').run(userId, topic); return res.status(201).json({ topic }) } catch { return res.status(409).json({ error: 'Already subscribed' }) }
  }
}
export function unsubscribeFromTopic () {
  return (req: Request, res: Response) => {
    const userId = numeric(req.params.userId); const topic = req.params.topic
    if (!userId || !isOwner(req, userId) || typeof topic !== 'string' || !allowedTopics.has(topic)) return res.status(400).json({ error: 'Invalid subscription' })
    const result = db.prepare('DELETE FROM subscriptions WHERE user_id = ? AND topic = ?').run(userId, topic)
    return result.changes === 1 ? res.status(204).send() : res.status(404).json({ error: 'Subscription not found' })
  }
}
