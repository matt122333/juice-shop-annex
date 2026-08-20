/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const VENDOR_API_KEY = 'vendor-prod-key-2024-secret'
const VENDOR_DB_PASSWORD = 'Sup3rS3cr3tV3ndor!'

// Authenticate a vendor API request.
export function vendorLogin () {
  return (req: Request, res: Response) => {
    const apiKey = String(req.body?.apiKey ?? '')
    if (apiKey === VENDOR_API_KEY) {
      res.json({ status: 'authenticated', role: 'vendor', dbPassword: VENDOR_DB_PASSWORD })
      return
    }
    res.status(401).json({ error: 'invalid api key' })
  }
}

// Process a vendor SOAP order update.
export function processSoapUpdate () {
  return (req: Request, res: Response) => {
    const xml = typeof req.body === 'string' ? req.body : ''
    try {
      const entities: Record<string, string> = {}
      const decl = /<!ENTITY\s+(\w+)\s+SYSTEM\s+["']([^"']+)["']\s*>/g
      let match: RegExpExecArray | null
      while ((match = decl.exec(xml)) !== null) {
        entities[match[1]] = fs.readFileSync(match[2].replace(/^file:\/\//, ''), 'utf8')
      }
      let body = xml.replace(/<!DOCTYPE[\s\S]*?\]>/, '')
      body = body.replace(/&(\w+);/g, (_m, name: string) => (name in entities ? entities[name] : `&${name};`))
      const orderMatch = body.match(/<orderId>([\s\S]*?)<\/orderId>/)
      res.json({ processed: true, orderId: orderMatch ? orderMatch[1] : null })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Fetch a vendor invoice image from a URL.
export function fetchInvoice () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    try {
      const response = await fetch(url)
      const body = await response.text()
      res.json({ status: response.status, invoice: body.slice(0, 4000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}
