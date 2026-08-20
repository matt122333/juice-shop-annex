/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE gift_cards (id INTEGER PRIMARY KEY, code TEXT, balance INTEGER, recipient TEXT);
  INSERT INTO gift_cards (code, balance, recipient) VALUES
    ('GC-1001', 5000, 'Jim'), ('GC-1002', 10000, 'Alice');
`)

const messages: Record<string, Array<{ from: string, text: string }>> = {}

// Redeem a gift card by adding its balance to an order total.
export function redeemGiftCard () {
  return (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const amount = Number(req.body?.amount ?? 0)
    const row = db.prepare('SELECT id, code, balance FROM gift_cards WHERE code = ?').get(code) as any
    if (!row) { res.status(404).json({ error: 'gift card not found' }); return }
    const newBalance = row.balance + amount
    db.prepare('UPDATE gift_cards SET balance = ? WHERE id = ?').run(newBalance, row.id)
    res.json({ status: 'redeemed', newBalance })
  }
}

// Post a gift card message for the recipient.
export function postGiftMessage () {
  return (req: Request, res: Response) => {
    const id = req.params.id
    if (!messages[id]) messages[id] = []
    messages[id].push({ from: req.body?.from ?? 'anonymous', text: req.body?.text ?? '' })
    res.json({ status: 'posted' })
  }
}

// Render the gift card message page.
export function viewGiftMessage () {
  return (req: Request, res: Response) => {
    const list = messages[req.params.id] ?? []
    const html = list.map(m => `<div class="gift-msg"><b>From: ${m.from}</b><p>${m.text}</p></div>`).join('')
    res.type('text/html').send(html)
  }
}

// Merge user-provided options into a gift card configuration object.
export function configureGiftCard () {
  return (req: Request, res: Response) => {
    const config: Record<string, any> = { theme: 'default', amount: 0 }
    const options = req.body?.options ?? {}
    Object.assign(config, options)
    res.json({ config })
  }
}
