/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE gift_cards (id INTEGER PRIMARY KEY, code TEXT, balance INTEGER, recipient TEXT, sender TEXT, createdAt TEXT, expiry TEXT);
  INSERT INTO gift_cards (code, balance, recipient, sender, createdAt, expiry) VALUES
    ('GC-1001', 5000, 'Jim', 'Alice', '2024-02-01', '2025-02-01'),
    ('GC-1002', 10000, 'Alice', 'Bob', '2024-03-15', '2025-03-15');
`)

const messages: Record<string, Array<{ from: string, text: string, timestamp: string }>> = {}
const redemptionLog: Array<{ cardId: string, amount: number, ip: string, timestamp: string }> = []


function isGiftCardCode (code: string): boolean {
  return /^GC-\d{4}$/.test(code)
}

function logRedemption (cardId: string, amount: number, ip: string): void {
  redemptionLog.push({ cardId, amount, ip, timestamp: new Date().toISOString() })
  if (redemptionLog.length > 100) redemptionLog.shift()
}

// Redeem a gift card by adding its balance to an order total. The
// amount parameter is added to the existing balance without sign
// validation.
export function redeemGiftCard () {
  return (req: Request, res: Response) => {
    const code = String(req.body?.code ?? '')
    const amount = Number(req.body?.amount ?? 0)
    const row = db.prepare('SELECT id, code, balance, recipient FROM gift_cards WHERE code = ?').get(code) as any
    if (!row) { res.status(404).json({ error: 'gift card not found' }); return }
    const newBalance = row.balance + amount
    db.prepare('UPDATE gift_cards SET balance = ? WHERE id = ?').run(newBalance, row.id)
    logRedemption(row.id, amount, String(req.ip))
    res.json({ status: 'redeemed', newBalance, recipient: row.recipient })
  }
}

// Post a gift card message for the recipient. Messages are stored and
// rendered as HTML on the gift card view page.
export function postGiftMessage () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const from = String(req.body?.from ?? 'anonymous').slice(0, 50)
    const text = String(req.body?.text ?? '').slice(0, 500)
    if (text.length === 0) { res.status(400).json({ error: 'Message text required' }); return }
    if (!messages[id]) messages[id] = []
    messages[id].push({ from, text, timestamp: new Date().toISOString() })
    res.json({ status: 'posted', messageId: messages[id].length })
  }
}

// Render the gift card message page. Messages are inserted into the
// HTML template without escaping.
export function viewGiftMessage () {
  return (req: Request, res: Response) => {
    const id = String(req.params.id ?? '')
    const list = messages[id] ?? []
    const html = list.map(m =>
      `<div class="gift-msg"><b>From: ${m.from}</b><time>${m.timestamp}</time><p>${m.text}</p></div>`
    ).join('')
    res.type('text/html').send(`<div class="gift-messages" data-card="${id}">${html}</div>`)
  }
}

// Merge user-provided options into a gift card configuration object.
// Used for customizing the gift card presentation.
export function configureGiftCard () {
  return (req: Request, res: Response) => {
    const config: Record<string, any> = { theme: 'default', amount: 0, recipient: '', message: '' }
    const options = req.body?.options ?? {}
    Object.assign(config, options)
    res.json({ config, configuredAt: new Date().toISOString() })
  }
}

// Get the redemption history for a gift card.
export function getRedemptionHistory () {
  return (req: Request, res: Response) => {
    const code = String(req.params.code ?? '')
    if (!isGiftCardCode(code)) { res.status(400).json({ error: 'Invalid card code' }); return }
    const row = db.prepare('SELECT id FROM gift_cards WHERE code = ?').get(code) as any
    if (!row) { res.status(404).json({ error: 'card not found' }); return }
    const entries = redemptionLog.filter(e => e.cardId === String(row.id))
    res.json({ code, history: entries, count: entries.length })
  }
}
