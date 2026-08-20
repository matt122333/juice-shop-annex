/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as dns from 'dns'

const eventLog: string[] = []

// Record an analytics event (log injection via CRLF).
export function recordEvent () {
  return (req: Request, res: Response) => {
    const event = String(req.body?.event ?? '')
    const ts = new Date().toISOString()
    eventLog.push(`[${ts}] ${event}`)
    res.json({ status: 'recorded' })
  }
}

// Fetch an analytics report from an external host (DNS rebinding SSRF).
export function fetchReport () {
  return async (req: Request, res: Response) => {
    const host = String(req.query.host ?? '')
    try {
      const addresses = await dns.promises.lookup(host)
      const url = `http://${host}:8080/report`
      const response = await fetch(url)
      const body = await response.text()
      res.json({ host, resolved: addresses.address, status: response.status, report: body.slice(0, 4000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Set cache headers for a tracking pixel (web cache poisoning).
export function trackingPixel () {
  return (req: Request, res: Response) => {
    const cacheKey = String(req.query.key ?? 'default')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('X-Track-Key', cacheKey)
    res.type('image/png').send(Buffer.alloc(0))
  }
}
