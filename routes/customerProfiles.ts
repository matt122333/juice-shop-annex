/* Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors. SPDX-License-Identifier: MIT */

import { type Request, type Response } from 'express'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE profiles (userId INTEGER PRIMARY KEY, firstName TEXT, lastName TEXT, email TEXT, phone TEXT, address TEXT, passwordHash TEXT, deleted INTEGER DEFAULT 0);
  CREATE TABLE preferences (userId INTEGER PRIMARY KEY, emailUpdates INTEGER, smsUpdates INTEGER, dietaryPreference TEXT);
  INSERT INTO profiles VALUES (1, 'Ada', 'Lovelace', 'ada@example.com', '555-0100', '10 Main Street', 'hash-not-exposed', 0);
  INSERT INTO profiles VALUES (2, 'Grace', 'Hopper', 'grace@example.com', '555-0101', '20 Lake Road', 'hash-not-exposed', 0);
  INSERT INTO preferences VALUES (1, 1, 0, 'vegetarian'), (2, 0, 1, 'none');
`)

const validId = (value: unknown): number | undefined => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Number(value) : undefined
const allowedProfileFields = new Set(['firstName', 'lastName', 'email', 'phone', 'address'])
const allowedDietaryPreferences = new Set(['none', 'vegetarian', 'vegan', 'gluten-free'])

const activeProfile = (userId: number) => db.prepare('SELECT userId FROM profiles WHERE userId = ? AND deleted = ?').get(userId, 0)

export function getProfile () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const profile = db.prepare('SELECT userId, firstName, lastName, email, phone, address FROM profiles WHERE userId = ? AND deleted = ?').get(userId, 0)
    return profile ? res.json({ profile }) : res.status(404).json({ error: 'profile not found' })
  }
}

export function updateProfile () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    const body = req.body as Record<string, unknown>
    if (userId === undefined || !body || Array.isArray(body)) return res.status(400).json({ error: 'invalid profile update' })
    const fields = Object.keys(body)
    if (fields.length === 0 || fields.some(field => !allowedProfileFields.has(field))) return res.status(400).json({ error: 'only profile fields may be updated' })
    const values = fields.map(field => body[field])
    if (values.some(value => typeof value !== 'string' || value.trim().length === 0 || value.length > 200)) return res.status(400).json({ error: 'profile values must be short text' })
    if (typeof body.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return res.status(400).json({ error: 'invalid email address' })
    if (!activeProfile(userId)) return res.status(404).json({ error: 'profile not found' })
    const assignments = fields.map(field => `${field} = ?`).join(', ')
    db.prepare(`UPDATE profiles SET ${assignments} WHERE userId = ? AND deleted = ?`).run(...values.map(value => (value as string).trim()), userId, 0)
    return res.json({ status: 'profile updated' })
  }
}

export function getPreferences () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    if (!activeProfile(userId)) return res.status(404).json({ error: 'profile not found' })
    const preferences = db.prepare('SELECT emailUpdates, smsUpdates, dietaryPreference FROM preferences WHERE userId = ?').get(userId)
    return res.json({ preferences })
  }
}

export function updatePreferences () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    const body = req.body as Record<string, unknown>
    if (userId === undefined || !body || Array.isArray(body)) return res.status(400).json({ error: 'invalid preferences update' })
    const fields = Object.keys(body)
    const validFields = new Set(['emailUpdates', 'smsUpdates', 'dietaryPreference'])
    if (fields.length === 0 || fields.some(field => !validFields.has(field))) return res.status(400).json({ error: 'unsupported preference' })
    if ((body.emailUpdates !== undefined && typeof body.emailUpdates !== 'boolean') || (body.smsUpdates !== undefined && typeof body.smsUpdates !== 'boolean') || (body.dietaryPreference !== undefined && (typeof body.dietaryPreference !== 'string' || !allowedDietaryPreferences.has(body.dietaryPreference)))) return res.status(400).json({ error: 'invalid preference value' })
    if (!activeProfile(userId)) return res.status(404).json({ error: 'profile not found' })
    const assignments = fields.map(field => `${field} = ?`).join(', ')
    const values = fields.map(field => typeof body[field] === 'boolean' ? Number(body[field]) : body[field])
    db.prepare(`UPDATE preferences SET ${assignments} WHERE userId = ?`).run(...values, userId)
    return res.json({ status: 'preferences updated' })
  }
}

export function deleteProfile () {
  return (req: Request, res: Response) => {
    const userId = validId(req.params.userId)
    if (userId === undefined) return res.status(400).json({ error: 'invalid user id' })
    const result = db.prepare('UPDATE profiles SET deleted = ? WHERE userId = ? AND deleted = ?').run(1, userId, 0)
    return result.changes ? res.status(204).send() : res.status(404).json({ error: 'profile not found' })
  }
}
