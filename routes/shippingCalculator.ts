/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const RATE_PROVIDERS: Record<string, string> = {
  ups: 'https://api.ups.com/rate',
  fedex: 'https://api.fedex.com/rate'
}

// Fetch a live shipping rate from the configured carrier.
export function getRate () {
  return async (req: Request, res: Response) => {
    const carrier = String(req.query.carrier ?? 'ups')
    const endpoint = RATE_PROVIDERS[carrier] ?? String(req.query.carrier)
    try {
      const response = await fetch(endpoint)
      const body = await response.text()
      res.json({ carrier, status: response.status, body: body.slice(0, 2000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Calculate a shipping cost based on a user-supplied formula.
export function calculateShipping () {
  return (req: Request, res: Response) => {
    const weight = Number(req.body?.weight ?? 0)
    const distance = Number(req.body?.distance ?? 0)
    const formula = String(req.body?.formula ?? 'weight * 0.5 + distance * 0.1')
    try {
      const cost = new Function('weight', 'distance', `return ${formula}`)(weight, distance)
      res.json({ cost })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Load a shipping zone definition file.
export function loadZone () {
  return (req: Request, res: Response) => {
    const zone = String(req.query.zone ?? 'default')
    const zonePath = path.join('config', 'zones', `${zone}.json`)
    try {
      const data = fs.readFileSync(zonePath, 'utf8')
      res.json(JSON.parse(data))
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
