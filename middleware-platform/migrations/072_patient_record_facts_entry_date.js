'use strict';

/**
 * P8 — entry_date denormalized for range queries once structured_json is ciphertext.
 * Also documents that structured_json / raw_extract_text are app-encrypted at rest.
 */
function up(db) {
  if (!db || typeof db.exec !== 'function') return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_record_facts (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      owner_key TEXT,
      tag TEXT NOT NULL,
      media_type TEXT,
      ai_or_manual TEXT NOT NULL,
      storage_ref TEXT,
      storage_provider TEXT,
      storage_key TEXT,
      structured_json TEXT,
      raw_extract_text TEXT,
      source_language TEXT,
      display_language TEXT,
      compare_group_id TEXT,
      request_id TEXT,
      confirmed_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      entry_date TEXT
    );
  `);
  // 067 may already have created the table without entry_date
  const cols = db.prepare(`PRAGMA table_info(patient_record_facts)`).all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('entry_date')) {
    db.exec(`ALTER TABLE patient_record_facts ADD COLUMN entry_date TEXT`);
  }
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_patient_record_facts_entry_date
     ON patient_record_facts(entry_date)`,
  );
}

module.exports = { up };
