'use strict';

/**
 * TOUCH-053 — Formal SQL for patient_allergen_exclusions (+ CRUD already in routes).
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_allergen_exclusions (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      allergen_class TEXT NOT NULL,
      label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_allergen_excl_session
      ON patient_allergen_exclusions(session_id);
    CREATE INDEX IF NOT EXISTS idx_allergen_excl_patient
      ON patient_allergen_exclusions(patient_id);
    CREATE INDEX IF NOT EXISTS idx_allergen_excl_class
      ON patient_allergen_exclusions(allergen_class);
  `);
}

module.exports = { id: '061_patient_allergen_exclusions', up };
