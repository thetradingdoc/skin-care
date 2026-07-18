'use strict';

/**
 * P1.02 — First-week welcome bonus (separate from monthly free meter).
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_welcome_bonus (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      owner_key TEXT NOT NULL UNIQUE,
      quota INTEGER NOT NULL,
      remaining INTEGER NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_welcome_bonus_owner
      ON ai_welcome_bonus(owner_key);
    CREATE INDEX IF NOT EXISTS idx_ai_welcome_bonus_expires
      ON ai_welcome_bonus(expires_at);
  `);
}

module.exports = { id: '066_ai_welcome_bonus', up };
