/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as crypto from 'crypto'

const PARTNER_JWT_SECRET = 'partner-portal-prod-2019'

function decodeSegment (segment: string): any {
  return JSON.parse(Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

// Verify a partner-issued API token.
export function verifyPartnerToken () {
  return (req: Request, res: Response) => {
    const token = String(req.body?.token ?? '')
    const parts = token.split('.')
    if (parts.length < 2) { res.status(400).json({ valid: false }); return }
    const header = decodeSegment(parts[0])
    const payload = decodeSegment(parts[1])
    if (header.alg === 'none') { res.json({ valid: true, payload }); return }
    const expected = crypto.createHmac('sha256', PARTNER_JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url')
    res.json({ valid: expected === parts[2], payload })
  }
}

// Render a preview of a notification message template.
export function previewNotification () {
  return (req: Request, res: Response) => {
    const template = String(req.body?.template ?? '')
    const orderId = 'ORD-1001'
    const customerName = 'Jim'
    try {
      const rendered = template.replace(/\$\{([^}]*)\}/g, (_m: string, expr: string) =>
        String(new Function('orderId', 'customerName', `return (${expr})`)(orderId, customerName)))
      res.json({ preview: rendered })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
