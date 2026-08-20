/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as crypto from 'crypto'

const MOBILE_JWT_SECRET = 'mobile'

const profiles: Record<string, any> = {
  '1': { id: 1, name: 'Jim', email: 'jim@juice-sh.op', role: 'customer' },
  '2': { id: 2, name: 'Alice', email: 'alice@juice-sh.op', role: 'customer' },
  '3': { id: 3, name: 'Admin', email: 'admin@juice-sh.op', role: 'admin' }
}

function b64urlDecode (s: string): any {
  return JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

// Verify a mobile app session token.
export function verifySession () {
  return (req: Request, res: Response) => {
    const token = String(req.headers.authorization ?? '').replace('Bearer ', '')
    const parts = token.split('.')
    if (parts.length < 2) { res.status(400).json({ valid: false }); return }
    const header = b64urlDecode(parts[0])
    const payload = b64urlDecode(parts[1])
    if (header.alg === 'HS256') {
      const expected = crypto.createHmac('sha256', MOBILE_JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url')
      res.json({ valid: expected === parts[2], payload })
      return
    }
    res.json({ valid: true, payload })
  }
}

// Get any user profile by id (mobile API).
export function getProfile () {
  return (req: Request, res: Response) => {
    const profile = profiles[req.params.id]
    if (!profile) { res.status(404).json({ error: 'not found' }); return }
    res.json(profile)
  }
}

// Proxy an image fetch through the server for the mobile client.
export function proxyImage () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    try {
      const response = await fetch(url)
      const body = await response.text()
      res.json({ status: response.status, content: body.slice(0, 4000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}
