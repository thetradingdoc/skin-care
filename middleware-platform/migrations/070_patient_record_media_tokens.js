'use strict';

/**
 * Durable short-TTL media access tokens for patient_record_facts (multi-instance safe).
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_record_media_tokens (
      token TEXT PRIMARY KEY,
      fact_id TEXT,
      storage_key TEXT,
      storage_provider TEXT,
      storage_ref TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_prf_media_tokens_expires
      ON patient_record_media_tokens(expires_at);
  `);
}

module.exports = { id: '070_patient_record_media_tokens', up };
