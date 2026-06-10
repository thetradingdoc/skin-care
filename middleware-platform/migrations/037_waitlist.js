'use strict';

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      source     TEXT,
      product    TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
  `);
}

function down(db) {
  db.exec('DROP TABLE IF EXISTS waitlist');
}

function waitlistRoute(db) {
  const insertStmt = db.prepare(`
    INSERT INTO waitlist (name, email, source, product)
    VALUES (@name, @email, @source, @product)
    ON CONFLICT(email) DO UPDATE SET
      name    = excluded.name,
      source  = excluded.source,
      product = excluded.product
  `);

  return async function handler(req, res) {
    const { name, email, source } = req.body || {};
    const productRaw = req.body?.product ?? req.body?.notes ?? null;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' });
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'valid email is required' });
    }

    const row = {
      name: name.trim().slice(0, 120),
      email: email.trim().toLowerCase().slice(0, 254),
      source: source ? String(source).trim().slice(0, 80) : 'routine_builder',
      product: productRaw ? String(productRaw).trim().slice(0, 8000) : null,
    };

    try {
      insertStmt.run(row);
    } catch (err) {
      console.error('[waitlist] insert error:', err.message);
      return res.status(500).json({ success: false, error: 'server error' });
    }

    try {
      const EmailService = require('../services/email-service');
      await EmailService.sendWaitlistAdminNotification(row);
    } catch (emailErr) {
      console.error('[waitlist] admin notify error:', emailErr.message);
    }

    return res.json({ success: true });
  };
}

module.exports = { up, down, waitlistRoute };
