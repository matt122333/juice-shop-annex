/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'
import { randomBytes, scryptSync } from 'crypto'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE vendors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, passwordHash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
  CREATE TABLE products (id INTEGER PRIMARY KEY, vendorId INTEGER NOT NULL, name TEXT NOT NULL, price REAL NOT NULL);
  CREATE TABLE vendorOrders (id INTEGER PRIMARY KEY, vendorId INTEGER NOT NULL, total REAL NOT NULL, status TEXT NOT NULL);
  INSERT INTO products VALUES (1,1,'Sample product',12.50); INSERT INTO vendorOrders VALUES (1,1,12.50,'paid');`)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const readId = (value: unknown): number | undefined => {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}
const hashPassword = (password: string): string => {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function registerVendor () {
  return (req: Request, res: Response): void => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (name.length < 2 || name.length > 100 || !emailPattern.test(email) || password.length < 12 || password.length > 128) { res.status(400).json({ error: 'Invalid vendor registration details.' }); return }
    try {
      const result = db.prepare('INSERT INTO vendors (name, email, passwordHash) VALUES (?, ?, ?)').run(name, email, hashPassword(password))
      res.status(201).json({ vendorId: Number(result.lastInsertRowid), status: 'pending' })
    } catch { res.status(409).json({ error: 'Vendor email is already registered.' }) }
  }
}

export function getVendorProfile () {
  return (req: Request, res: Response): void => {
    const vendorId = readId(req.params.vendorId)
    if (vendorId === undefined) { res.status(400).json({ error: 'Invalid vendor ID.' }); return }
    const vendor = db.prepare('SELECT id, name, email, status FROM vendors WHERE id = ?').get(vendorId)
    if (vendor === undefined) { res.status(404).json({ error: 'Vendor not found.' }); return }
    res.status(200).json({ vendor })
  }
}

export function updateVendorProfile () {
  return (req: Request, res: Response): void => {
    const vendorId = readId(req.params.vendorId)
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined
    if (vendorId === undefined || (name === undefined && email === undefined) || (name !== undefined && (name.length < 2 || name.length > 100)) || (email !== undefined && !emailPattern.test(email))) { res.status(400).json({ error: 'Invalid vendor profile update.' }); return }
    try {
      const result = db.prepare('UPDATE vendors SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?').run(name ?? null, email ?? null, vendorId)
      if (result.changes !== 1) { res.status(404).json({ error: 'Vendor not found.' }); return }
      res.status(200).json({ updated: true })
    } catch { res.status(409).json({ error: 'Vendor email is already registered.' }) }
  }
}

export function getVendorProducts () {
  return (req: Request, res: Response): void => {
    const vendorId = readId(req.params.vendorId)
    if (vendorId === undefined) { res.status(400).json({ error: 'Invalid vendor ID.' }); return }
    const products = db.prepare('SELECT id, name, price FROM products WHERE vendorId = ? ORDER BY id').all(vendorId)
    res.status(200).json({ products })
  }
}

export function getVendorOrders () {
  return (req: Request, res: Response): void => {
    const vendorId = readId(req.params.vendorId)
    const limit = readId(req.query.limit) ?? 20
    const offset = typeof req.query.offset === 'string' && /^\d+$/.test(req.query.offset) ? Number(req.query.offset) : 0
    if (vendorId === undefined || limit > 100 || !Number.isSafeInteger(offset)) { res.status(400).json({ error: 'Invalid pagination details.' }); return }
    const orders = db.prepare('SELECT id, total, status FROM vendorOrders WHERE vendorId = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(vendorId, limit, offset)
    res.status(200).json({ orders, limit, offset })
  }
}
