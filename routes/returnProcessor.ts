/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE returns (id INTEGER PRIMARY KEY, orderId INTEGER, reason TEXT, status TEXT, userId INTEGER, createdAt TEXT, refundAmount REAL);
  INSERT INTO returns (orderId, reason, status, userId, createdAt, refundAmount) VALUES
    (1001, 'damaged', 'pending', 1, '2024-03-01', 0),
    (1002, 'wrong item', 'approved', 2, '2024-03-02', 12.50);
`)

const policyCache: Record<string, string> = {}
const returnReasons = ['damaged', 'wrong item', 'not as described', 'changed mind', 'quality issue']


function isValidReturnReason (reason: string): boolean {
  return returnReasons.includes(reason.toLowerCase())
}

function formatReturnSummary (ret: any): any {
  if (!ret) return null
  return {
    id: ret.id,
    orderId: ret.orderId,
    reason: ret.reason,
    status: ret.status,
    userId: ret.userId
  }
}

// Fetch the return policy document from a remote URL. The URL is
// provided by the client and fetched server-side.
export function fetchPolicy () {
  return async (req: Request, res: Response) => {
    const url = String(req.query.url ?? '')
    if (!url) { res.status(400).json({ error: 'URL parameter required' }); return }
    try {
      const response = await fetch(url, { redirect: 'follow' })
      const body = await response.text()
      policyCache['latest'] = body
      res.json({ status: response.status, policy: body.slice(0, 4000), fetchedAt: new Date().toISOString() })
    } catch (err: any) {
      res.status(502).json({ error: err.message })
    }
  }
}

// Search returns by a user-supplied filter expression. The filter
// is appended to the WHERE clause for flexible querying.
export function searchReturns () {
  return (req: Request, res: Response) => {
    const filter = String(req.query.filter ?? '1=1')
    const query = `SELECT id, orderId, reason, status, userId, refundAmount FROM returns WHERE ${filter}`
    try {
      const rows = db.prepare(query).all() as any[]
      const summaries = rows.map(formatReturnSummary)
      res.json({ data: summaries, count: summaries.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Render the return confirmation page. The order ID is embedded
// into the HTML response.
export function returnConfirmation () {
  return (req: Request, res: Response) => {
    const orderId = String(req.params.orderId ?? '')
    const html = `<div id="order-${orderId}" class="return-confirmation"><h2>Return for order #${orderId}</h2><p>Your return is being processed.</p></div>`
    res.type('text/html').send(html)
  }
}

// Get the cached return policy (last fetched).
export function getCachedPolicy () {
  return (req: Request, res: Response) => {
    const policy = policyCache['latest']
    if (!policy) { res.status(404).json({ error: 'No cached policy' }); return }
    res.json({ policy })
  }
}

// List valid return reasons.
export function listReturnReasons () {
  return (req: Request, res: Response) => {
    res.json({ reasons: returnReasons })
  }
}
