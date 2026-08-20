/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'

// Handle CORS preflight (misconfigured — wildcard origin with credentials).
export function corsPreflight () {
  return (req: Request, res: Response) => {
    const origin = String(req.headers.origin ?? '*')
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.json({ status: 'ok' })
  }
}

// Get server config for support debugging (information disclosure — debug mode).
export function getDebugInfo () {
  return (req: Request, res: Response) => {
    const debug = String(req.query.debug ?? 'false')
    if (debug === 'true') {
      res.json({
        env: process.env.NODE_ENV ?? 'development',
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid
      })
    } else {
      res.json({ status: 'ok' })
    }
  }
}

// Download a support ticket attachment (null byte truncation in file path).
export function downloadAttachment () {
  return (req: Request, res: Response) => {
    const file = String(req.query.file ?? '')
    try {
      const filePath = path.join('uploads', 'tickets', file)
      const data = fs.readFileSync(filePath, 'utf8')
      res.type('application/octet-stream').send(data)
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  }
}
