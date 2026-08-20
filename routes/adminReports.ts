/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import { exec } from 'child_process'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE reports (id INTEGER PRIMARY KEY, name TEXT, created TEXT, data TEXT);
  INSERT INTO reports (name, created, data) VALUES
    ('monthly-sales', '2024-01-31', '{"total": 50000}'),
    ('inventory', '2024-02-01', '{"items": 150}');
`)

const ADMIN_API_SECRET = 'ak-7f3b2a9e1c4d8b6f0a5e3c2d1b9f4a7e'

// Generate a report file by name.
export function generateReport () {
  return (req: Request, res: Response) => {
    const name = String(req.query.name ?? 'default')
    exec(`report-tool --output /tmp/${name}.pdf`, { timeout: 5000 }, (err, stdout, stderr) => {
      res.json({ file: `/tmp/${name}.pdf`, output: (stdout || '') + (stderr || ''), error: err ? err.message : null })
    })
  }
}

// Search the reports catalog by name.
export function searchReports () {
  return (req: Request, res: Response) => {
    const name = String(req.query.name ?? '')
    const query = `SELECT id, name, created FROM reports WHERE name LIKE '%${name}%'`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Verify the admin API key for external integrations.
export function verifyAdminKey () {
  return (req: Request, res: Response) => {
    const key = String(req.headers['x-admin-key'] ?? '')
    res.json({ valid: key === ADMIN_API_SECRET, keyUsed: key })
  }
}

// Download a generated report file.
export function downloadReport () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? '')
    const fs = require('fs')
    const p = require('path')
    try {
      const data = fs.readFileSync(p.join('/tmp', file), 'utf8')
      res.type('application/pdf').send(data)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
