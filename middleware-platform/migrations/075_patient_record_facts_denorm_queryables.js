'use strict';

/**
 * Denormalize queryable fields out of structured_json (same pattern as entry_date / 072).
 * subtype | expiry_date | provider | issue_date — indexed for reminders / Progress / filters.
 * Optical SPH/CYL/AXIS stay in encrypted structured_json only.
 */
function up(db) {
  if (!db || typeof db.exec !== 'function') return;
  const cols = db.prepare(`PRAGMA table_info(patient_record_facts)`).all();
  const names = new Set(cols.map((c) => c.name));
  const add = (col) => {
    if (!names.has(col)) db.exec(`ALTER TABLE patient_record_facts ADD COLUMN ${col} TEXT`);
  };
  add('fact_subtype');
  add('expiry_date');
  add('provider');
  add('issue_date');
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_patient_record_facts_expiry_date
     ON patient_record_facts(expiry_date)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_patient_record_facts_subtype
     ON patient_record_facts(tag, fact_subtype)`,
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_patient_record_facts_provider
     ON patient_record_facts(provider)`,
  );
}

module.exports = { up };
