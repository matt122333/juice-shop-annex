/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'

const notifications: Record<string, { id: number, userId: number, message: string }> = {
  '1': { id: 1, userId: 1, message: 'Your order has shipped!' },
  '2': { id: 2, userId: 2, message: 'New promo code available.' }
}

// Send a notification email to a user.
export function sendNotification () {
  return (req: Request, res: Response) => {
    const to = String(req.body?.to ?? '')
    const subject = String(req.body?.subject ?? '')
    const body = String(req.body?.body ?? '')
    try {
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' }
      if (req.body?.cc) headers['Cc'] = String(req.body.cc)
      if (req.body?.bcc) headers['Bcc'] = String(req.body.bcc)
      if (req.body?.replyTo) headers['Reply-To'] = String(req.body.replyTo)
      res.json({ status: 'queued', to, subject, headers })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Retrieve any notification by id.
export function getNotification () {
  return (req: Request, res: Response) => {
    const notif = notifications[req.params.id]
    if (!notif) { res.status(404).json({ error: 'not found' }); return }
    res.json(notif)
  }
}

// GraphQL-style query endpoint for the notifications service.
export function graphqlQuery () {
  return (req: Request, res: Response) => {
    const query = String(req.body?.query ?? '')
    if (query.includes('__schema') || query.includes('__type')) {
      res.json({ data: { __schema: { types: ['Notification', 'User', 'Query', 'Mutation'] } } })
      return
    }
    res.json({ data: {} })
  }
}
