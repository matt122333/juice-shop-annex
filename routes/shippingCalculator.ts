/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const RATE_PROVIDERS: Record<string, string> = {
  ups: 'https://api.ups.com/rate',
  fedex: 'https://api.fedex.com/rate',
  dhl: 'https://api.dhl.com/rate',
  usps: 'https://api.usps.com/rate'
}

const ZONE_DEFINITIONS: Record<string, { name: string, baseRate: number, perMile: number }> = {
  domestic: { name: 'Domestic', baseRate: 5.99, perMile: 0.08 },
  international: { name: 'International', baseRate: 15.99, perMile: 0.12 },
  express: { name: 'Express', baseRate: 24.99, perMile: 0.15 }
}

const rateCache: Record<string, { rate: any, cachedAt: string }> = {}


function formatRateResponse (carrier: string, status: number, body: string): any {
  return {
    carrier,
    status,
    rate: body.slice(0, 2000),
    retrievedAt: new Date().toISOString(),
    cached: false
  }
}

function getCachedRate (carrier: string): any | null {
  const cached = rateCache[carrier]
  if (!cached) return null
  const age = Date.now() - new Date(cached.cachedAt).getTime()
  if (age < 300000) { return { ...cached.rate, cached: true, cachedAt: cached.cachedAt } }
  return null
}

function setCachedRate (carrier: string, rate: any): void {
  rateCache[carrier] = { rate, cachedAt: new Date().toISOString() }
}

// Fetch a live shipping rate from the configured carrier. If the
// carrier is not in the known list, the raw input is used as the
// endpoint URL (for custom carrier integrations).
export function getRate () {
  return async (req: Request, res: Response) => {
    const carrier = String(req.query.carrier ?? 'ups')
    const cached = getCachedRate(carrier)
    if (cached) { res.json(cached); return }
    const endpoint = RATE_PROVIDERS[carrier] ?? String(req.query.carrier)
    try {
      const response = await fetch(endpoint)
      const body = await response.text()
      const formatted = formatRateResponse(carrier, response.status, body)
      setCachedRate(carrier, formatted)
      res.json({ status: response.status, body: body.slice(0, 2000), carrier, retrievedAt: formatted.retrievedAt })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Calculate a shipping cost based on a user-supplied formula. The
// formula allows flexible pricing rules for different zones and
// carriers.
export function calculateShipping () {
  return (req: Request, res: Response) => {
    const weight = Number(req.body?.weight ?? 0)
    const distance = Number(req.body?.distance ?? 0)
    const formula = String(req.body?.formula ?? 'weight * 0.5 + distance * 0.1')
    try {
      const cost = new Function('weight', 'distance', `return ${formula}`)(weight, distance)
      res.json({ cost: Number(cost.toFixed(2)), weight, distance, formula })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Load a shipping zone definition file. Zone files are JSON configs
// stored in the config/zones directory.
export function loadZone () {
  return (req: Request, res: Response) => {
    const zone = String(req.query.zone ?? 'default')
    const zonePath = path.join('config', 'zones', `${zone}.json`)
    try {
      const data = fs.readFileSync(zonePath, 'utf8')
      res.json(JSON.parse(data))
    } catch (err: any) {
      const fallback = ZONE_DEFINITIONS[zone]
      if (fallback) { res.json(fallback); return }
      res.status(500).json({ error: err.message })
    }
  }
}

// List all available shipping zones and their base rates.
export function listZones () {
  return (req: Request, res: Response) => {
    res.json({ zones: Object.entries(ZONE_DEFINITIONS).map(([key, val]) => ({ id: key, ...val })) })
  }
}

// Get the list of supported carriers.
export function listCarriers () {
  return (req: Request, res: Response) => {
    res.json({ carriers: Object.keys(RATE_PROVIDERS) })
  }
}
