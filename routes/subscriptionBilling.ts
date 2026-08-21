/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE subscriptions (userId INTEGER PRIMARY KEY, planId TEXT NOT NULL, updatedAt TEXT NOT NULL);
  CREATE TABLE invoices (id INTEGER PRIMARY KEY, userId INTEGER NOT NULL, amount REAL NOT NULL, issuedAt TEXT NOT NULL);
  CREATE TABLE paymentMethods (userId INTEGER PRIMARY KEY, cardLast4 TEXT NOT NULL, expiry TEXT NOT NULL);
  INSERT INTO subscriptions VALUES (1, 'basic', '2026-01-01T00:00:00.000Z'), (2, 'premium', '2026-01-01T00:00:00.000Z');
  INSERT INTO invoices VALUES (1, 1, 9.99, '2026-01-15'), (2, 1, 9.99, '2026-02-15'), (3, 2, 19.99, '2026-01-15');
`)

const plans = new Set(['basic', 'premium', 'annual'])
const validId = (value: unknown): number | undefined => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Number(value) : undefined
const isValidCard = (value: string): boolean => {
  if (!/^\d{12,19}$/.test(value)) return false
  let sum = 0
  for (let index = value.length - 1, factor = 1; index >= 0; index--, factor = factor === 1 ? 2 : 1) {
    const product = Number(value[index]) * factor
    sum += product > 9 ? product - 9 : product
  }
  return sum % 10 === 0
}

export function getCurrentPlan () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const plan = db.prepare('SELECT userId, planId, updatedAt FROM subscriptions WHERE userId = ?').get(userId)
    return plan ? res.json({ plan }) : res.status(404).json({ error: 'subscription not found' })
  }
}

export function upgradePlan () {
  return (req: Request, res: Response) => {
    const userId = validId(req.body?.userId)
    const planId = typeof req.body?.planId === 'string' ? req.body.planId : ''
    if (userId === undefined || !plans.has(planId)) return res.status(400).json({ error: 'valid user and plan are required' })
    const result = db.prepare('UPDATE subscriptions SET planId = ?, updatedAt = ? WHERE userId = ?').run(planId, new Date().toISOString(), userId)
    return result.changes ? res.json({ status: 'upgraded', planId }) : res.status(404).json({ error: 'subscription not found' })
  }
}

export function getInvoiceHistory () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const invoices = db.prepare('SELECT id, amount, issuedAt FROM invoices WHERE userId = ? ORDER BY issuedAt DESC').all(userId)
    return res.json({ invoices })
  }
}

export function downloadInvoice () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    const invoiceId = validId(req.params.invoiceId)
    if (userId === undefined || invoiceId === undefined) return res.status(400).json({ error: 'invalid invoice request' })
    const invoice = db.prepare('SELECT id, amount, issuedAt FROM invoices WHERE id = ? AND userId = ?').get(invoiceId, userId) as { id: number, amount: number, issuedAt: string } | undefined
    if (!invoice) return res.status(404).json({ error: 'invoice not found' })
    const document = `Invoice ${invoice.id}\nIssued: ${invoice.issuedAt}\nAmount: $${invoice.amount.toFixed(2)}\n`
    return res.type('text/plain').attachment(`invoice-${invoice.id}.txt`).send(document)
  }
}

export function updatePaymentMethod () {
  return (req: Request, res: Response) => {
    const userId = validId(req.body?.userId)
    const cardNumber = typeof req.body?.cardNumber === 'string' ? req.body.cardNumber.replace(/[ -]/g, '') : ''
    const expiry = typeof req.body?.expiry === 'string' ? req.body.expiry : ''
    if (userId === undefined || !isValidCard(cardNumber) || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return res.status(400).json({ error: 'valid card number and expiry are required' })
    const subscription = db.prepare('SELECT userId FROM subscriptions WHERE userId = ?').get(userId)
    if (!subscription) return res.status(404).json({ error: 'subscription not found' })
    db.prepare('INSERT INTO paymentMethods (userId, cardLast4, expiry) VALUES (?, ?, ?) ON CONFLICT(userId) DO UPDATE SET cardLast4 = excluded.cardLast4, expiry = excluded.expiry').run(userId, cardNumber.slice(-4), expiry)
    return res.json({ status: 'payment method updated', cardLast4: cardNumber.slice(-4) })
  }
}
