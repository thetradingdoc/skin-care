'use strict';

/**
 * P2.28 — Scope request_id uniqueness per owner_key (same pattern as ai_capture_usage).
 *
 * 2a left a GLOBAL unique on request_id while the comment claimed per-owner.
 * This migration:
 * 1) drops idx_prf_request_id (global)
 * 2) adds owner_key TEXT
 * 3) backfills owner_key from patient_id / session_id
 * 4) creates UNIQUE(owner_key, request_id) where request_id is set
 */

function columnExists(db, table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === col);
}

function up(db) {
  require('./067_patient_record_facts').up(db);

  db.exec(`DROP INDEX IF EXISTS idx_prf_request_id;`);

  if (!columnExists(db, 'patient_record_facts', 'owner_key')) {
    db.exec(`ALTER TABLE patient_record_facts ADD COLUMN owner_key TEXT;`);
  }

  // Backfill: match ai-capture-meter resolveOwnerKey (patient:… | session:…)
  db.exec(`
    UPDATE patient_record_facts
    SET owner_key = CASE
      WHEN patient_id IS NOT NULL AND trim(patient_id) != '' THEN 'patient:' || patient_id
      WHEN session_id IS NOT NULL AND trim(session_id) != '' THEN 'session:' || session_id
      ELSE owner_key
    END
    WHERE owner_key IS NULL OR owner_key = '';
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prf_owner_created
      ON patient_record_facts(owner_key, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prf_owner_request_id
      ON patient_record_facts(owner_key, request_id)
      WHERE request_id IS NOT NULL AND length(request_id) > 0
        AND owner_key IS NOT NULL AND length(owner_key) > 0;
  `);
}

module.exports = { id: '068_patient_record_facts_owner_request_id', up };
