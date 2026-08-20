/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

// Include a content template by file name (local file inclusion).
export function includeTemplate () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? 'default')
    const filePath = path.join('views', 'templates', file)
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      res.type('text/html').send(content)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Render a content block using EJS template engine.
export function renderContent () {
  return (req: Request, res: Response) => {
    const template = String(req.body?.template ?? '<%= title %>')
    const data = { title: 'Welcome', user: 'guest' }
    try {
      const ejs = require('ejs')
      const html = ejs.render(template, data)
      res.type('text/html').send(html)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}

// Read a content asset file (symlink attack — follows symlinks).
export function readAsset () {
  return (req: Request, res: Response) => {
    const asset = String(req.query.asset ?? 'default')
    const assetPath = path.join('public', 'assets', asset)
    try {
      const data = fs.readFileSync(assetPath, 'utf8')
      res.type('text/plain').send(data)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
