/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE replies (id INTEGER PRIMARY KEY AUTOINCREMENT, ticketId INTEGER NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL);
  CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
  INSERT INTO categories VALUES (1,'Order help'),(2,'Product question'),(3,'Account support');`)
const cleanText = (value: unknown, minimum: number, maximum: number): string | undefined => {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/[<>]/g, '').trim()
  return text.length >= minimum && text.length <= maximum ? text : undefined
}
const readId = (value: unknown): number | undefined => {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function createTicket () {
  return (req: Request, res: Response): void => {
    const subject = cleanText(req.body?.subject, 3, 120)
    const body = cleanText(req.body?.body, 10, 5000)
    if (subject === undefined || body === undefined) { res.status(400).json({ error: 'Invalid ticket content.' }); return }
    const createdAt = new Date().toISOString()
    const result = db.prepare('INSERT INTO tickets (subject, body, status, createdAt) VALUES (?, ?, ?, ?)').run(subject, body, 'open', createdAt)
    res.status(201).json({ ticketId: Number(result.lastInsertRowid), status: 'open' })
  }
}

export function getTicket () {
  return (req: Request, res: Response): void => {
    const ticketId = readId(req.params.ticketId)
    if (ticketId === undefined) { res.status(400).json({ error: 'Invalid ticket ID.' }); return }
    const ticket = db.prepare('SELECT id, subject, body, status, createdAt FROM tickets WHERE id = ?').get(ticketId)
    if (ticket === undefined) { res.status(404).json({ error: 'Ticket not found.' }); return }
    res.status(200).json({ ticket })
  }
}

export function replyToTicket () {
  return (req: Request, res: Response): void => {
    const ticketId = readId(req.params.ticketId)
    const body = cleanText(req.body?.body, 1, 5000)
    if (ticketId === undefined || body === undefined) { res.status(400).json({ error: 'Invalid ticket reply.' }); return }
    const ticket = db.prepare('SELECT id FROM tickets WHERE id = ? AND status = ?').get(ticketId, 'open')
    if (ticket === undefined) { res.status(409).json({ error: 'Ticket is unavailable for replies.' }); return }
    const result = db.prepare('INSERT INTO replies (ticketId, body, createdAt) VALUES (?, ?, ?)').run(ticketId, body, new Date().toISOString())
    res.status(201).json({ replyId: Number(result.lastInsertRowid) })
  }
}

export function closeTicket () {
  return (req: Request, res: Response): void => {
    const ticketId = readId(req.params.ticketId)
    if (ticketId === undefined) { res.status(400).json({ error: 'Invalid ticket ID.' }); return }
    const result = db.prepare('UPDATE tickets SET status = ? WHERE id = ? AND status = ?').run('closed', ticketId, 'open')
    if (result.changes !== 1) { res.status(409).json({ error: 'Ticket cannot be closed.' }); return }
    res.status(200).json({ status: 'closed' })
  }
}

export function listTicketCategories () {
  return (_req: Request, res: Response): void => {
    const categories = db.prepare('SELECT id, name FROM categories ORDER BY name').all()
    res.status(200).json({ categories })
  }
}
