'use strict';

/**
 * P3.18 — capture_sessions for multi-tag capture flows.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS capture_sessions (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      capture_token TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      queue_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (status IN ('active','complete','abandoned'))
    );
    CREATE INDEX IF NOT EXISTS idx_capture_sessions_patient
      ON capture_sessions(patient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_capture_sessions_session
      ON capture_sessions(session_id, created_at);
  `);
}

module.exports = { id: '071_capture_sessions', up };
