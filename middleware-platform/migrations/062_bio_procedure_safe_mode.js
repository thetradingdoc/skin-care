'use strict';

/**
 * TOUCH-100 — procedure_date / procedure_type for post-procedure safe-mode.
 */

function columnExists(db, table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === col);
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_bio_profiles (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      patient_id TEXT,
      conditions_json TEXT NOT NULL DEFAULT '[]',
      prescriptions_json TEXT NOT NULL DEFAULT '[]',
      sensitivity TEXT DEFAULT 'none',
      fitzpatrick TEXT,
      zip TEXT,
      profile_complete INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!columnExists(db, 'patient_bio_profiles', 'procedure_date')) {
    db.exec(`ALTER TABLE patient_bio_profiles ADD COLUMN procedure_date TEXT`);
  }
  if (!columnExists(db, 'patient_bio_profiles', 'procedure_type')) {
    db.exec(`ALTER TABLE patient_bio_profiles ADD COLUMN procedure_type TEXT`);
  }
  if (!columnExists(db, 'patient_bio_profiles', 'procedure_recovery_days')) {
    db.exec(`ALTER TABLE patient_bio_profiles ADD COLUMN procedure_recovery_days INTEGER`);
  }
}

module.exports = { id: '062_bio_procedure_safe_mode', up };
