'use strict';

/**
 * P6.01 — AI credits ledger (packs purchased + balance).
 * Every mutation is an append-only ledger row; balance is derived and stored for fast reads.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_credits_ledger (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      session_id TEXT,
      owner_key TEXT NOT NULL,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      stripe_event_id TEXT,
      stripe_checkout_session_id TEXT,
      pack_size INTEGER,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(stripe_event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_ai_credits_ledger_patient
      ON ai_credits_ledger(patient_id, datetime(created_at) DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_credits_ledger_owner
      ON ai_credits_ledger(owner_key, datetime(created_at) DESC);

    CREATE TABLE IF NOT EXISTS ai_credits_balance (
      owner_key TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      balance INTEGER NOT NULL DEFAULT 0,
      packs_purchased INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_monetization_webhook_dedupe (
      stripe_event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      handler TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Track which meter bucket funded a consume (for paid-credit refunds)
  try {
    db.exec(`ALTER TABLE ai_capture_usage ADD COLUMN meter_source TEXT`);
  } catch (_) {
    /* column may already exist */
  }
}

function down(db) {
  db.exec(`
    DROP TABLE IF EXISTS ai_monetization_webhook_dedupe;
    DROP TABLE IF EXISTS ai_credits_balance;
    DROP TABLE IF EXISTS ai_credits_ledger;
  `);
}

module.exports = { up, down };
