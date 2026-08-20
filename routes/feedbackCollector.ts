/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const feedbackStore: Record<string, Array<{ name: string, message: string }>> = {}

// Export feedback data as CSV.
export function exportCsv () {
  return (req: Request, res: Response) => {
    const product = String(req.query.product ?? 'all')
    const items = feedbackStore[product] ?? []
    const csv = ['name,message', ...items.map(f => `${f.name},${f.message}`)].join('\n')
    res.type('text/csv').set('Content-Disposition', `attachment; filename="feedback_${product}.csv"`).send(csv)
  }
}

// Submit feedback for a product with markdown formatting.
export function submitFeedback () {
  return (req: Request, res: Response) => {
    const product = req.params.product
    if (!feedbackStore[product]) feedbackStore[product] = []
    const name = String(req.body?.name ?? 'anonymous')
    const message = String(req.body?.message ?? '')
    feedbackStore[product].push({ name, message })
    res.json({ status: 'received' })
  }
}

// Render feedback as HTML for the product page.
export function viewFeedback () {
  return (req: Request, res: Response) => {
    const product = req.params.product
    const list = feedbackStore[product] ?? []
    const html = list.map(f => `<div class="feedback"><b>${f.name}</b><p>${f.message}</p></div>`).join('')
    res.type('text/html').send(html)
  }
}

// Parse and process a feedback XML attachment.
export function parseXmlFeedback () {
  return (req: Request, res: Response) => {
    const xml = typeof req.body === 'string' ? req.body : ''
    try {
      const entities: Record<string, string> = {}
      let match: RegExpExecArray | null
      const decl = /<!ENTITY\s+(\w+)\s+SYSTEM\s+["']([^"']+)["']\s*>/g
      while ((match = decl.exec(xml)) !== null) {
        entities[match[1]] = fs.readFileSync(match[2].replace(/^file:\/\//, ''), 'utf8')
      }
      let body = xml.replace(/<!DOCTYPE[\s\S]*?\]>/, '')
      body = body.replace(/&(\w+);/g, (_m, name: string) => (name in entities ? entities[name] : `&${name};`))
      const nameMatch = body.match(/<message>([\s\S]*?)<\/message>/)
      res.json({ parsed: nameMatch ? nameMatch[1] : null })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
