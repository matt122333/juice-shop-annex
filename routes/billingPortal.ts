/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE billing_accounts (id INTEGER PRIMARY KEY, userId INTEGER, balance REAL, password TEXT, cardToken TEXT);
  INSERT INTO billing_accounts (userId, balance, password, cardToken) VALUES
    (1, 150.00, 'plaintextpass123', 'tok_abc123'), (2, 75.50, 'letmein456', 'tok_def456');
`)

// Get billing account details (password stored in plaintext).
export function getAccount () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const row = db.prepare('SELECT id, userId, balance, password, cardToken FROM billing_accounts WHERE id = ?').get(id) as any
    if (!row) { res.status(404).json({ error: 'not found' }); return }
    res.json(row)
  }
}

// Update billing balance (SQL injection in UPDATE statement).
export function updateBalance () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const balance = String(req.body?.balance ?? '0')
    try {
      const query = `UPDATE billing_accounts SET balance = ${balance} WHERE id = ${id}`
      const info = db.prepare(query).run()
      res.json({ status: 'updated', changes: info.changes })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Redirect to payment gateway (open redirect via Referer header).
export function paymentRedirect () {
  return (req: Request, res: Response) => {
    const referer = String(req.headers.referer ?? '/')
    res.redirect(referer)
  }
}
