'use strict';

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_journal_entries (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      patient_id TEXT,
      session_id TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      photo_storage_ref TEXT,
      condition_tags_json TEXT,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'standalone',
      routine_daily_entry_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_key, entry_date)
    );
    CREATE INDEX IF NOT EXISTS idx_journal_owner_date ON patient_journal_entries(owner_key, entry_date);
    CREATE INDEX IF NOT EXISTS idx_journal_session_date ON patient_journal_entries(session_id, entry_date);
    CREATE INDEX IF NOT EXISTS idx_journal_patient_date ON patient_journal_entries(patient_id, entry_date);
  `);
}

module.exports = { up };
