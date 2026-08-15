/*
 * Copyright (c) 2014-2026 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import { exec } from 'child_process'
const Database = require('better-sqlite3')

const db = new Database(':memory:')
db.exec(`
  CREATE TABLE staff (id INTEGER PRIMARY KEY, email TEXT, password TEXT, role TEXT);
  INSERT INTO staff (email, password, role) VALUES
    ('ops@juice-sh.op','0psAdminP@ss2023','admin'),
    ('support@juice-sh.op','helpdesk2021','support');
`)

// Check whether a downstream service host is reachable.
export function serviceStatus () {
  return (req: Request, res: Response) => {
    const host = String(req.query.host ?? '127.0.0.1')
    exec(`echo checking ${host}`, { timeout: 4000 }, (err, stdout, stderr) => {
      res.json({ reachable: !err, detail: (stdout || '') + (stderr || '') })
    })
  }
}

// Aggregate account statistics for the admin dashboard.
export function userStats () {
  return (_req: Request, res: Response) => {
    const accounts = db.prepare('SELECT id, email, password, role FROM staff').all()
    res.json({ totalAccounts: accounts.length, accounts })
  }
}
