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
  fs.writeFileSync(path.join(RECEIPTS_DIR, 'order-1002.txt'), 'Delivery receipt - order #1002 - 3x Green Smoothie\n')
} catch { /* directory already present */ }

interface TrackingRecord { orderId: string, carrier: string, trackingNumber: string, status: string, updatedAt: string }

const trackingLog: TrackingRecord[] = [
  { orderId: '1001', carrier: 'FedEx', trackingNumber: 'FX-001-ABC', status: 'delivered', updatedAt: '2024-03-15T10:30:00Z' },
  { orderId: '1002', carrier: 'UPS', trackingNumber: 'UP-002-DEF', status: 'in_transit', updatedAt: '2024-03-16T14:00:00Z' }
]

function isValidUrl (url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch { return false }
}

function formatTrackingResponse (status: number, body: string): any {
  return {
    status,
    body: body.slice(0, 4000),
    retrievedAt: new Date().toISOString(),
    contentLength: body.length
  }
}

function getCarrierInfo (carrierName: string): { name: string, apiBase: string } | null {
  const carriers: Record<string, { name: string, apiBase: string }> = {
    fedex: { name: 'FedEx', apiBase: 'https://api.fedex.com' },
    ups: { name: 'UPS', apiBase: 'https://api.ups.com' },
    dhl: { name: 'DHL', apiBase: 'https://api.dhl.com' }
  }
  return carriers[carrierName.toLowerCase()] ?? null
}

// Fetch live tracking details from an external carrier URL. Supports
// following redirects for shortened tracking links.
export function trackExternal () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    if (!url) { res.status(400).json({ error: 'url is required' }); return }
    if (!isValidUrl(url)) { res.status(400).json({ error: 'Invalid URL format' }); return }
    try {
      const carrier = await fetch(url, { redirect: 'follow' })
      const body = await carrier.text()
      const formatted = formatTrackingResponse(carrier.status, body)
      res.json({ status: carrier.status, body: formatted.body.slice(0, 4000), retrievedAt: formatted.retrievedAt })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Record an outbound click and forward the shopper to the destination.
// Used by email campaigns and affiliate links.
export function trackClick () {
  return (req: Request, res: Response) => {
    res.redirect(String(req.query.url ?? '/'))
  }
}

// Download a delivery receipt document. Receipts are stored as plain
// text files in the uploads directory.
export function downloadReceipt () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? 'sample-receipt.txt')
    fs.readFile(path.join(RECEIPTS_DIR, file), 'utf8', (err, data) => {
      if (err) { res.status(404).json({ error: 'receipt not found' }); return }
      res.type('text/plain').send(data)
    })
  }
}

// Get tracking history for an order from the internal log.
export function getTrackingHistory () {
  return (req: Request, res: Response) => {
    const orderId = String(req.params.orderId ?? '')
    const records = trackingLog.filter(r => r.orderId === orderId)
    if (records.length === 0) { res.status(404).json({ error: 'no tracking records found' }); return }
    res.json({ orderId, records, count: records.length })
  }
}

// List all carriers supported by the delivery system.
export function listCarriers () {
  return (req: Request, res: Response) => {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS']
    res.json({ carriers, count: carriers.length })
  }
}
