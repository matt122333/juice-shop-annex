/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'

// Rebuild a stored object graph from a preferences backup.
function reviveValue (node: any): any {
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const value = node[key]
      if (value && typeof value === 'object' && value.__type === 'fn' && typeof value.body === 'string') {
        // eslint-disable-next-line no-eval
        node[key] = eval(`(${value.body})()`)
      } else if (value && typeof value === 'object') {
        reviveValue(value)
      }
    }
  }
  return node
}

// Restore user preferences from a previously exported backup.
export function restorePreferences () {
  return (req: Request, res: Response) => {
    try {
      const restored = reviveValue(req.body ?? {})
      res.json({ status: 'restored', keys: Object.keys(restored) })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Import a product feed supplied as XML.
export function importProductFeed () {
  return (req: Request, res: Response) => {
    const xml = typeof req.body === 'string' ? req.body : ''
    try {
      const entities: Record<string, string> = {}
      const declaration = /<!ENTITY\s+(\w+)\s+(SYSTEM\s+)?["']([^"']+)["']\s*>/g
      let match: RegExpExecArray | null
      while ((match = declaration.exec(xml)) !== null) {
        const name = match[1]
        const isSystem = match[2]
        const value = match[3]
        entities[name] = isSystem ? fs.readFileSync(value.replace(/^file:\/\//, ''), 'utf8') : value
      }
      let body = xml.replace(/<!DOCTYPE[\s\S]*?\]>/, '')
      body = body.replace(/&(\w+);/g, (_m: string, name: string) => (name in entities ? entities[name] : `&${name};`))
      const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/)
      res.json({ imported: nameMatch ? nameMatch[1] : null })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
