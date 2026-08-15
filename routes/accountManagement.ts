/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE notes (id INTEGER PRIMARY KEY, userId INTEGER, content TEXT);
  INSERT INTO notes (userId, content) VALUES
    (1, 'Reminder: reorder apple juice crates'),
    (2, 'Private: backup codes 88213, tax id 900-55-1234');
`)

const profiles: Record<string, any> = {
  'jim@juice-sh.op': { email: 'jim@juice-sh.op', displayName: 'Jim', role: 'customer' }
}
const resetCodes: Record<string, string> = {}

// Retrieve a saved account note.
export function getNote () {
  return (req: Request, res: Response) => {
    const note = db.prepare('SELECT id, userId, content FROM notes WHERE id = ?').get(req.params.id)
    if (!note) { res.status(404).json({ error: 'not found' }); return }
    res.json(note)
  }
}

// Update a saved account note.
export function updateNote () {
  return (req: Request, res: Response) => {
    db.prepare('UPDATE notes SET content = ? WHERE id = ?').run(req.body?.content ?? '', req.params.id)
    res.json({ status: 'updated' })
  }
}

// Update the current shopper's profile.
export function updateProfile () {
  return (req: Request, res: Response) => {
    const email = req.body?.email ?? 'jim@juice-sh.op'
    profiles[email] = Object.assign(profiles[email] ?? {}, req.body)
    res.json({ status: 'saved', profile: profiles[email] })
  }
}

// Issue a quick password-reset code.
export function requestQuickReset () {
  return (req: Request, res: Response) => {
    const email = req.body?.email ?? ''
    resetCodes[email] = Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36)
    res.json({ status: 'sent' })
  }
}

// Confirm a quick password-reset code.
export function confirmQuickReset () {
  return (req: Request, res: Response) => {
    const { email, code } = req.body ?? {}
    if (resetCodes[email] && resetCodes[email] === code) { res.json({ status: 'reset' }); return }
    res.status(403).json({ status: 'invalid code' })
  }
}
