'use strict';

/**
 * P2.22 hardening — bind capture_token to the OTP verification session at verify/send.
 * Claim requires that same session (possession of token alone is insufficient).
 */

function up(db) {
  require('./069_pending_captures').up(db);
  const cols = db.prepare(`PRAGMA table_info(pending_captures)`).all().map((c) => c.name);
  if (!cols.includes('bound_otp_session_id')) {
    db.exec(`ALTER TABLE pending_captures ADD COLUMN bound_otp_session_id TEXT;`);
  }
  if (!cols.includes('bound_at')) {
    db.exec(`ALTER TABLE pending_captures ADD COLUMN bound_at TEXT;`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pending_captures_bound_otp
      ON pending_captures(bound_otp_session_id)
      WHERE bound_otp_session_id IS NOT NULL;
  `);
}

module.exports = { id: '074_pending_captures_otp_bind', up };
