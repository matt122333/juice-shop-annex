/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as crypto from 'crypto'

const sessions: Record<string, { userId: number, role: string, preAuth: boolean }> = {
  'session-abc': { userId: 1, role: 'customer', preAuth: false }
}

const users: Record<string, { id: number, passwordHash: string, salt: string }> = {
  admin: { id: 1, passwordHash: '', salt: 'fixed-salt' }
}
// Pre-compute SHA1 hash for "admin123" with the fixed salt
users.admin.passwordHash = crypto.createHash('sha1').update('fixed-salt' + 'admin123').digest('hex')

// Login and create a session (session fixation — reuses existing session ID).
export function login () {
  return (req: Request, res: Response) => {
    const user = String(req.body?.user ?? '')
    const pass = String(req.body?.password ?? '')
    const session = String(req.body?.session ?? '')
    const record = users[user]
    if (!record) { res.status(404).json({ error: 'user not found' }); return }
    const hash = crypto.createHash('sha1').update(record.salt + pass).digest('hex')
    if (hash === record.passwordHash) {
      if (session && sessions[session]) {
        sessions[session] = { userId: record.id, role: 'admin', preAuth: false }
        res.json({ session, userId: record.id, role: 'admin' })
        return
      }
      const newSession = 'session-' + Math.random().toString(36).substring(2)
      sessions[newSession] = { userId: record.id, role: 'customer', preAuth: false }
      res.json({ session: newSession, userId: record.id, role: 'customer' })
    } else {
      res.status(401).json({ error: 'invalid password' })
    }
  }
}

// Set a session cookie (insecure flags).
export function setSessionCookie () {
  return (req: Request, res: Response) => {
    const session = String(req.query.session ?? 'default')
    res.setHeader('Set-Cookie', `session=${session}; Path=/`)
    res.json({ status: 'cookie set' })
  }
}

// Reset a password (uses SHA1 for hashing — weak).
export function resetPassword () {
  return (req: Request, res: Response) => {
    const user = String(req.body?.user ?? '')
    const newPass = String(req.body?.password ?? '')
    if (!users[user]) { res.status(404).json({ error: 'user not found' }); return }
    const salt = 'fixed-salt'
    const hash = crypto.createHash('sha1').update(salt + newPass).digest('hex')
    users[user].passwordHash = hash
    res.json({ status: 'reset', hashAlgorithm: 'SHA1' })
  }
}
