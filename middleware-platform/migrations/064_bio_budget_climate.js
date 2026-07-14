'use strict';

/**
 * TOUCH-088/089 — budget + climate on bio profiles.
 */

function columnExists(db, table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === col);
}

function up(db) {
  require('./055_conflict_engine').up(db);
  require('./062_bio_procedure_safe_mode').up(db);
  if (!columnExists(db, 'patient_bio_profiles', 'budget_band')) {
    db.exec(`ALTER TABLE patient_bio_profiles ADD COLUMN budget_band TEXT`);
  }
  if (!columnExists(db, 'patient_bio_profiles', 'climate_zone')) {
    db.exec(`ALTER TABLE patient_bio_profiles ADD COLUMN climate_zone TEXT`);
  }
}

module.exports = { id: '064_bio_budget_climate', up };
