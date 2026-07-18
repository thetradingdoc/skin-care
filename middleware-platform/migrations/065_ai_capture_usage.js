'use strict';

/**
 * P1.01 — AI capture usage ledger (monthly meter + per-call cost fields).
 * patient_id / session_id are nullable so anonymous / pre-auth owners can be keyed later (P2.20).
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_capture_usage (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      owner_key TEXT NOT NULL,
      capture_kind TEXT NOT NULL,
      model TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      estimated_usd REAL,
      status TEXT NOT NULL DEFAULT 'consumed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_ai_capture_usage_owner_created
      ON ai_capture_usage(owner_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_capture_usage_patient_created
      ON ai_capture_usage(patient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_capture_usage_session_created
      ON ai_capture_usage(session_id, created_at);
  `);
}

module.exports = { id: '065_ai_capture_usage', up };
