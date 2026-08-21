/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE zones (id INTEGER PRIMARY KEY, name TEXT NOT NULL, baseRate REAL NOT NULL, perKg REAL NOT NULL, deliveryDays INTEGER NOT NULL);
  CREATE TABLE carriers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL);
  INSERT INTO zones VALUES (1,'Domestic',4.99,1.25,3),(2,'International',14.99,4.50,10);
  INSERT INTO carriers VALUES (1,'ParcelPost',1),(2,'ExpressShip',1);`)

const readId = (value: unknown): number | undefined => {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
const findZone = (id: number) => db.prepare('SELECT id, name, baseRate, perKg, deliveryDays FROM zones WHERE id = ?').get(id)

export function getShippingZones () {
  return (_req: Request, res: Response): void => {
    const zones = db.prepare('SELECT id, name, baseRate, deliveryDays FROM zones WHERE id > ? ORDER BY id').all(0)
    res.status(200).json({ zones })
  }
}

export function getZoneRate () {
  return (req: Request, res: Response): void => {
    const zoneId = readId(req.params.zoneId)
    if (zoneId === undefined) { res.status(400).json({ error: 'Invalid zone ID.' }); return }
    const zone = findZone(zoneId)
    if (zone === undefined) { res.status(404).json({ error: 'Shipping zone not found.' }); return }
    res.status(200).json({ zoneId: zone.id, baseRate: zone.baseRate, perKg: zone.perKg })
  }
}

export function calculateShippingCost () {
  return (req: Request, res: Response): void => {
    const zoneId = readId(req.body?.zoneId)
    const weight = Number(req.body?.weight)
    if (zoneId === undefined || !Number.isFinite(weight) || weight <= 0 || weight > 1000) { res.status(400).json({ error: 'Invalid shipping calculation details.' }); return }
    const zone = findZone(zoneId)
    if (zone === undefined) { res.status(404).json({ error: 'Shipping zone not found.' }); return }
    const cost = Math.round((zone.baseRate + zone.perKg * weight) * 100) / 100
    res.status(200).json({ zoneId, weight, cost, currency: 'USD' })
  }
}

export function getDeliveryEstimate () {
  return (req: Request, res: Response): void => {
    const zoneId = readId(req.params.zoneId)
    if (zoneId === undefined) { res.status(400).json({ error: 'Invalid zone ID.' }); return }
    const zone = findZone(zoneId)
    if (zone === undefined) { res.status(404).json({ error: 'Shipping zone not found.' }); return }
    res.status(200).json({ zoneId, estimatedBusinessDays: zone.deliveryDays })
  }
}

export function listCarriers () {
  return (_req: Request, res: Response): void => {
    const carriers = db.prepare('SELECT id, name FROM carriers WHERE active = 1 ORDER BY name').all()
    res.status(200).json({ carriers })
  }
}
