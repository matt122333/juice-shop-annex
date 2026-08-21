/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */
import { type Request, type Response } from 'express'

const Database = require('better-sqlite3')
const db = new Database(':memory:')
db.exec(`CREATE TABLE pages (id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL); INSERT INTO pages VALUES (1,'shipping-info','Shipping information','Delivery details','2026-01-01T00:00:00.000Z');`)
const slugOf = (value: unknown): string | undefined => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 50 ? value : undefined
const textOf = (value: unknown, maxLength: number): string | undefined => typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength ? value.trim() : undefined
const sanitizeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] as string)
const admin = (req: Request): boolean => (req as any).user?.role === 'admin'
const error = (res: Response, status: number, message: string): void => { res.status(status).json({ error: message }) }

export function getPage () {
  return (req: Request, res: Response): void => {
    const slug = slugOf(req.params.slug)
    if (!slug) return error(res, 400, 'Invalid page slug')
    try {
      const page = db.prepare('SELECT id, slug, title, body, updated_at AS updatedAt FROM pages WHERE slug = ?').get(slug)
      if (!page) return error(res, 404, 'Page not found')
      res.json(page)
    } catch { error(res, 500, 'Unable to load page') }
  }
}

export function listPages () {
  return (_req: Request, res: Response): void => {
    try {
      const pages = db.prepare('SELECT id, slug, title FROM pages ORDER BY title').all()
      res.json({ pages })
    } catch { error(res, 500, 'Unable to list pages') }
  }
}
export function createPage () {
  return (req: Request, res: Response): void => {
    if (!admin(req)) return error(res, 403, 'Administrator access required')
    const slug = slugOf(req.body?.slug); const title = textOf(req.body?.title, 120); const body = textOf(req.body?.body, 20000)
    if (!slug || !title || !body) return error(res, 400, 'Invalid page details')
    try { const updatedAt = new Date().toISOString(); const result = db.prepare('INSERT INTO pages (slug, title, body, updated_at) VALUES (?, ?, ?, ?)').run(slug, title, sanitizeHtml(body), updatedAt); res.status(201).json({ id: result.lastInsertRowid, slug, title, updatedAt }) } catch { error(res, 409, 'Page slug already exists') }
  }
}
export function updatePage () {
  return (req: Request, res: Response): void => {
    if (!admin(req)) return error(res, 403, 'Administrator access required'); const slug = slugOf(req.params.slug); const title = textOf(req.body?.title, 120); const body = textOf(req.body?.body, 20000)
    if (!slug || !title || !body) return error(res, 400, 'Invalid page details')
    try { const updatedAt = new Date().toISOString(); const result = db.prepare('UPDATE pages SET title = ?, body = ?, updated_at = ? WHERE slug = ?').run(title, sanitizeHtml(body), updatedAt, slug); if (result.changes !== 1) return error(res, 404, 'Page not found'); res.json({ slug, title, updatedAt }) } catch { error(res, 500, 'Unable to update page') }
  }
}
export function deletePage () {
  return (req: Request, res: Response): void => {
    if (!admin(req)) return error(res, 403, 'Administrator access required')
    const slug = slugOf(req.params.slug)
    if (!slug) return error(res, 400, 'Invalid page slug')
    try {
      const result = db.prepare('DELETE FROM pages WHERE slug = ?').run(slug)
      if (result.changes !== 1) return error(res, 404, 'Page not found')
      res.status(204).send()
    } catch { error(res, 500, 'Unable to delete page') }
  }
}
