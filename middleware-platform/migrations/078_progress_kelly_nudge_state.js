'use strict';

/**
 * 078 — Progress Kelly nudge + rate-limit state (same table).
 *
 * - last_message_type / last_message_date: repeat-nudge facts (successful
 *   generations only). Never store message body.
 * - last_attempt_at: ISO datetime clock for per-(patient, mark) min-interval
 *   rate limiting. Updated on completed attempts including fallbacks;
 *   NOT updated when serving rate_limited (avoids resetting its own clock).
 */

function ensureLastAttemptColumn(db) {
  const cols = db
    .prepare(`PRAGMA table_info(progress_kelly_nudge_state)`)
    .all()
    .map((c) => c.name);
  if (!cols.includes('last_attempt_at')) {
    db.exec(`ALTER TABLE progress_kelly_nudge_state ADD COLUMN last_attempt_at TEXT`);
  }
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_kelly_nudge_state (
      patient_id TEXT NOT NULL,
      mark_id TEXT NOT NULL,
      last_message_type TEXT,
      last_message_date TEXT,
      last_attempt_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (patient_id, mark_id),
      CHECK (
        last_message_type IS NULL
        OR last_message_type IN ('observation', 'prompt', 'milestone')
      )
    );
    CREATE INDEX IF NOT EXISTS idx_pk_nudge_patient
      ON progress_kelly_nudge_state(patient_id);
  `);
  ensureLastAttemptColumn(db);
}

module.exports = { id: '078_progress_kelly_nudge_state', up, ensureLastAttemptColumn };
