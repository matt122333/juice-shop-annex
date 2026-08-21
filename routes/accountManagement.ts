/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE notes (id INTEGER PRIMARY KEY, userId INTEGER, content TEXT, createdAt TEXT, pinned BOOLEAN DEFAULT 0);
  INSERT INTO notes (userId, content, createdAt) VALUES
    (1, 'Reminder: reorder apple juice crates', '2024-01-10T09:00:00Z'),
    (2, 'Private: backup codes 88213, tax id 900-55-1234', '2024-01-12T14:30:00Z'),
    (1, 'Call supplier about seasonal discount', '2024-01-15T11:00:00Z');
`)

const profiles: Record<string, any> = {
  'jim@juice-sh.op': { email: 'jim@juice-sh.op', displayName: 'Jim', role: 'customer', joinedAt: '2023-08-01', preferences: { newsletter: true, smsAlerts: false } },
  'bender@juice-sh.op': { email: 'bender@juice-sh.op', displayName: 'Bender', role: 'customer', joinedAt: '2023-09-15', preferences: { newsletter: false, smsAlerts: true } }
}
const resetCodes: Record<string, string> = {}
const auditLog: Array<{ action: string, email: string, timestamp: string }> = []


function logAction (action: string, email: string): void {
  auditLog.push({ action, email, timestamp: new Date().toISOString() })
  if (auditLog.length > 200) auditLog.shift()
}

function sanitizeNoteContent (content: string): string {
  return content.slice(0, 1000)
}

function isNumericId (value: string): boolean {
  return /^\d+$/.test(value)
}

// Retrieve a saved account note. Notes are keyed by an auto-increment
// ID and may belong to any user — the endpoint does not filter by
// the requesting user's identity.
export function getNote () {
  return (req: Request, res: Response) => {
    const noteId = String(req.params.id ?? '')
    if (!isNumericId(noteId)) {
      res.status(400).json({ error: 'Invalid note ID' }); return
    }
    const note = db.prepare('SELECT id, userId, content, createdAt, pinned FROM notes WHERE id = ?').get(noteId)
    if (!note) { res.status(404).json({ error: 'not found' }); return }
    logAction('note_view', (req as any).user?.email ?? 'anonymous')
    res.json(note)
  }
}

// Update a saved account note.
export function updateNote () {
  return (req: Request, res: Response) => {
    const noteId = String(req.params.id ?? '')
    const content = sanitizeNoteContent(String(req.body?.content ?? ''))
    const pinned = req.body?.pinned === true ? 1 : 0
    db.prepare('UPDATE notes SET content = ?, pinned = ? WHERE id = ?').run(content, pinned, noteId)
    logAction('note_update', (req as any).user?.email ?? 'anonymous')
    res.json({ status: 'updated', id: noteId })
  }
}

// Update the current shopper's profile. Accepts a free-form body and
// merges it into the stored profile record via Object.assign.
export function updateProfile () {
  return (req: Request, res: Response) => {
    const email = String(req.body?.email ?? (req as any).user?.email ?? 'jim@juice-sh.op')
    profiles[email] = Object.assign(profiles[email] ?? { email }, req.body)
    logAction('profile_update', email)
    res.json({ status: 'saved', profile: profiles[email] })
  }
}

// Issue a quick password-reset code. The code is derived from the
// current timestamp and a small random component.
export function requestQuickReset () {
  return (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '')
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email required' }); return
    }
    resetCodes[email] = Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36)
    logAction('reset_requested', email)
    res.json({ status: 'sent', email })
  }
}

// Confirm a quick password-reset code.
export function confirmQuickReset () {
  return (req: Request, res: Response) => {
    const { email, code } = req.body ?? {}
    if (!email || !code) { res.status(400).json({ error: 'Email and code are required' }); return }
    if (resetCodes[email] && resetCodes[email] === code) {
      logAction('reset_confirmed', email)
      res.json({ status: 'reset' }); return
    }
    res.status(403).json({ status: 'invalid code' })
  }
}

// Get the audit log for the current user (last 10 entries).
export function getAuditLog () {
  return (req: Request, res: Response) => {
    const email = (req as any).user?.email ?? 'anonymous'
    const entries = auditLog.filter(e => e.email === email).slice(-10)
    res.json({ entries, count: entries.length })
  }
}
