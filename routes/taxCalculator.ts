/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import { exec } from 'child_process'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE tax_rates (id INTEGER PRIMARY KEY, region TEXT, rate REAL, code TEXT);
  INSERT INTO tax_rates (region, rate, code) VALUES
    ('CA', 0.0875, 'TAX-CA'), ('NY', 0.08, 'TAX-NY'), ('TX', 0.0625, 'TAX-TX');
`)

// Calculate tax using a user-supplied formula expression.
export function calculateTax () {
  return (req: Request, res: Response) => {
    const subtotal = Number(req.body?.subtotal ?? 0)
    const formula = String(req.body?.formula ?? 'subtotal * 0.08')
    try {
      const tax = new Function('subtotal', `return ${formula}`)(subtotal)
      res.json({ tax, total: subtotal + tax })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Look up a tax rate by region code via LDAP-style query.
export function lookupTaxRate () {
  return (req: Request, res: Response) => {
    const user = String(req.query.user ?? '')
    const filter = String(req.query.filter ?? 'objectClass=*')
    try {
      exec(`ldapsearch -x -b "dc=juice-sh,dc=op" "(&(uid=${user})(${filter}))"`, { timeout: 5000 }, (err, stdout, stderr) => {
        res.json({ output: (stdout || '') + (stderr || ''), error: err ? err.message : null })
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Search tax rates by a user-supplied condition.
export function searchTaxRates () {
  return (req: Request, res: Response) => {
    const condition = String(req.query.condition ?? '1=1')
    const query = `SELECT id, region, rate, code FROM tax_rates WHERE ${condition}`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
