/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

const moderationQueue: Array<{ id: number, content: string, type: string }> = [
  { id: 1, content: 'Great product!', type: 'text' },
  { id: 2, content: 'Fast delivery', type: 'text' }
]

// Parse a review submission in XML format (XML bomb / entity expansion).
export function parseXmlReview () {
  return (req: Request, res: Response) => {
    const xml = typeof req.body === 'string' ? req.body : ''
    try {
      const entities: Record<string, string> = {}
      const decl = /<!ENTITY\s+(\w+)\s+SYSTEM\s+["']([^"']+)["']\s*>/g
      let match: RegExpExecArray | null
      while ((match = decl.exec(xml)) !== null) {
        entities[match[1]] = fs.readFileSync(match[2].replace(/^file:\/\//, ''), 'utf8')
      }
      let body = xml.replace(/<!DOCTYPE[\s\S]*?\]>/, '')
      body = body.replace(/&(\w+);/g, (_m, name: string) => (name in entities ? entities[name] : `&${name};`))
      const contentMatch = body.match(/<content>([\s\S]*?)<\/content>/)
      res.json({ parsed: contentMatch ? contentMatch[1] : null })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Upload a review attachment (insecure file upload — no type validation).
export function uploadAttachment () {
  return (req: Request, res: Response) => {
    const filename = String(req.body?.filename ?? 'upload.txt')
    const content = String(req.body?.content ?? '')
    const uploadDir = 'uploads'
    const filePath = path.join(uploadDir, filename)
    try {
      fs.mkdirSync(uploadDir, { recursive: true })
      fs.writeFileSync(filePath, content)
      res.json({ status: 'uploaded', path: filePath })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Process nested review metadata (denial of service via recursion).
export function processMetadata () {
  return (req: Request, res: Response) => {
    const data = req.body?.data
    function depth (obj: any): number {
      if (typeof obj !== 'object' || obj === null) return 0
      let max = 0
      for (const key of Object.keys(obj)) {
        max = Math.max(max, depth(obj[key]) + 1)
      }
      return max
    }
    try {
      const d = depth(data)
      res.json({ depth: d })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
