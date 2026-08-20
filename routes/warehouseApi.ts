/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE warehouse (id INTEGER PRIMARY KEY, location TEXT, capacity INTEGER, manager TEXT);
  INSERT INTO warehouse (location, capacity, manager) VALUES
    ('North', 5000, 'Alice'), ('South', 3000, 'Bob'), ('East', 7000, 'Carol');
`)

// Delete a warehouse record by id (SQL injection in DELETE).
export function deleteWarehouse () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    try {
      const query = `DELETE FROM warehouse WHERE id = ${id}`
      const info = db.prepare(query).run()
      res.json({ status: 'deleted', changes: info.changes })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Check if a warehouse service is reachable (SSRF via DNS resolution).
export function checkService () {
  return async (req: Request, res: Response) => {
    const service = String(req.query.service ?? '')
    try {
      const url = `http://${service}:9090/health`
      const response = await fetch(url)
      const body = await response.text()
      res.json({ service, status: response.status, response: body.slice(0, 2000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Get warehouse info with a substring slice (buffer over-read — info disclosure).
export function getWarehouseInfo () {
  return (req: Request, res: Response) => {
    const id = Number(req.query.id ?? 0)
    const row = db.prepare('SELECT id, location, capacity, manager FROM warehouse WHERE id = ?').get(id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    const raw = JSON.stringify(row)
    const len = Number(req.query.len ?? raw.length)
    res.json({ info: raw.slice(0, len), fullLength: raw.length })
  }
}
