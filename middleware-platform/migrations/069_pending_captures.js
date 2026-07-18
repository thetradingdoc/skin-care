'use strict';

/**
 * P2.20 — pending_captures ownership for pre-auth → post-auth claim.
 *
 * capture_token: opaque secret the client stashes and sends on OTP verify.
 * anon_session_id: session_id / owner session:… key used on facts + meter before claim.
 * patient_id: null until claimed.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_captures (
      id TEXT PRIMARY KEY,
      capture_token TEXT NOT NULL UNIQUE,
      anon_session_id TEXT NOT NULL,
      patient_id TEXT,
      claimed_session_id TEXT,
      fact_ids_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TEXT NOT NULL,
      claimed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (status IN ('pending','claimed','expired','purged'))
    );
    CREATE INDEX IF NOT EXISTS idx_pending_captures_token
      ON pending_captures(capture_token);
    CREATE INDEX IF NOT EXISTS idx_pending_captures_anon
      ON pending_captures(anon_session_id);
    CREATE INDEX IF NOT EXISTS idx_pending_captures_status_expires
      ON pending_captures(status, expires_at);
  `);
}

module.exports = { id: '069_pending_captures', up };
