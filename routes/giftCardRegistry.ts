/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const crypto = require('crypto')
const db = new Database(':memory:')
db.exec('CREATE TABLE gift_cards (code TEXT PRIMARY KEY, initial_amount REAL NOT NULL, balance REAL NOT NULL, created_at TEXT NOT NULL); CREATE TABLE gift_card_transactions (id INTEGER PRIMARY KEY, code TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT NOT NULL)')
const codeOf = (value: unknown): string | undefined => typeof value === 'string' && /^[A-Z0-9]{16}$/.test(value) ? value : undefined
const amountOf = (value: unknown, maximum: number): number | undefined => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= maximum ? value : undefined
const fail = (res: Response, status: number, message: string): void => { res.status(status).json({ error: message }) }
const createCode = (): string => crypto.randomBytes(8).toString('hex').toUpperCase()

export function createGiftCard () {
  return (req: Request, res: Response): void => {
    const amount = amountOf(req.body?.amount, 500); if (amount === undefined) return fail(res, 400, 'Amount must be between 1 and 500')
    try { let code = createCode(); while (db.prepare('SELECT 1 FROM gift_cards WHERE code = ?').get(code)) code = createCode(); const createdAt = new Date().toISOString(); db.prepare('INSERT INTO gift_cards (code, initial_amount, balance, created_at) VALUES (?, ?, ?, ?)').run(code, amount, amount, createdAt); res.status(201).json({ code, balance: amount, createdAt }) } catch { fail(res, 500, 'Unable to create gift card') }
  }
}
export function getGiftCard () {
  return (req: Request, res: Response): void => {
    const code = codeOf(req.params.code)
    if (!code) return fail(res, 400, 'Invalid card code')
    try {
      const card = db.prepare('SELECT code, initial_amount AS initialAmount, balance, created_at AS createdAt FROM gift_cards WHERE code = ?').get(code)
      if (!card) return fail(res, 404, 'Gift card not found')
      res.json(card)
    } catch { fail(res, 500, 'Unable to load gift card') }
  }
}

export function checkBalance () {
  return (req: Request, res: Response): void => {
    const code = codeOf(req.params.code)
    if (!code) return fail(res, 400, 'Invalid card code')
    try {
      const card = db.prepare('SELECT balance FROM gift_cards WHERE code = ?').get(code)
      if (!card) return fail(res, 404, 'Gift card not found')
      res.json({ code, balance: card.balance })
    } catch { fail(res, 500, 'Unable to check balance') }
  }
}
export function redeemGiftCard () {
  return (req: Request, res: Response): void => {
    const code = codeOf(req.params.code); const amount = amountOf(req.body?.amount, 500); if (!code || amount === undefined) return fail(res, 400, 'Invalid redemption details')
    try { const redeem = db.transaction(() => { const card = db.prepare('SELECT balance FROM gift_cards WHERE code = ?').get(code) as { balance: number } | undefined; if (!card) throw new Error('missing'); if (amount > card.balance) throw new Error('balance'); const balance = card.balance - amount; db.prepare('UPDATE gift_cards SET balance = ? WHERE code = ?').run(balance, code); db.prepare('INSERT INTO gift_card_transactions (code, amount, created_at) VALUES (?, ?, ?)').run(code, -amount, new Date().toISOString()); return balance }); res.json({ code, balance: redeem() }) } catch { fail(res, 400, 'Card not found or insufficient balance') }
  }
}
export function listGiftCardTransactions () {
  return (req: Request, res: Response): void => {
    const code = codeOf(req.params.code)
    if (!code) return fail(res, 400, 'Invalid card code')
    try {
      const card = db.prepare('SELECT 1 FROM gift_cards WHERE code = ?').get(code)
      if (!card) return fail(res, 404, 'Gift card not found')
      const transactions = db.prepare('SELECT id, amount, created_at AS createdAt FROM gift_card_transactions WHERE code = ? ORDER BY id DESC').all(code)
      res.json({ transactions })
    } catch { fail(res, 500, 'Unable to load transactions') }
  }
}
