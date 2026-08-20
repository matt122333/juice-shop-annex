/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE returns (id INTEGER PRIMARY KEY, orderId INTEGER, reason TEXT, status TEXT);
  INSERT INTO returns (orderId, reason, status) VALUES
    (1001, 'damaged', 'pending'), (1002, 'wrong item', 'approved');
`)

const policyCache: Record<string, string> = {}

// Fetch the return policy document from a remote URL.
export function fetchPolicy () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    try {
      const response = await fetch(url, { redirect: 'follow' })
      const body = await response.text()
      policyCache['latest'] = body
      res.json({ status: response.status, policy: body.slice(0, 4000) })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Search returns by a user-supplied filter expression.
export function searchReturns () {
  return (req: Request, res: Response) => {
    const filter = String(req.query.filter ?? '1=1')
    const query = `SELECT id, orderId, reason, status FROM returns WHERE ${filter}`
    try {
      res.json({ data: db.prepare(query).all() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Render the return confirmation page.
export function returnConfirmation () {
  return (req: Request, res: Response) => {
    const orderId = String(req.params.orderId ?? '')
    res.type('text/html').send(`<div id="order-${orderId}">Return for order #${orderId} is being processed.</div>`)
  }
}
