/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as path from 'path'
import * as fs from 'fs'

const RECEIPTS_DIR = path.resolve('uploads', 'delivery-receipts')
try {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true })
  fs.writeFileSync(path.join(RECEIPTS_DIR, 'sample-receipt.txt'), 'Delivery receipt - order #1001 - 1x Apple Juice\n')
} catch { /* directory already present */ }

// Fetch live tracking details from an external carrier URL.
export function trackExternal () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    if (!url) { res.status(400).json({ error: 'url is required' }); return }
    try {
      const carrier = await fetch(url, { redirect: 'follow' })
      const body = await carrier.text()
      res.json({ status: carrier.status, body: body.slice(0, 4000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Record an outbound click and forward the shopper to the destination.
export function trackClick () {
  return (req: Request, res: Response) => {
    res.redirect(String(req.query.url ?? '/'))
  }
}

// Download a delivery receipt document.
export function downloadReceipt () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? 'sample-receipt.txt')
    fs.readFile(path.join(RECEIPTS_DIR, file), 'utf8', (err, data) => {
      if (err) { res.status(404).json({ error: 'receipt not found' }); return }
      res.type('text/plain').send(data)
    })
  }
}
