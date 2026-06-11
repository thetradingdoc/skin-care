'use strict';

/** Conflict engine: bio profiles, lineup snapshots, shelf INCI columns. */

module.exports = {
  id: '055_conflict_engine',
  up(db) {
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

      CREATE UNIQUE INDEX IF NOT EXISTS idx_bio_profiles_session
        ON patient_bio_profiles(session_id);

      CREATE INDEX IF NOT EXISTS idx_bio_profiles_patient
        ON patient_bio_profiles(patient_id);

      CREATE TABLE IF NOT EXISTS patient_routine_lineup_snapshots (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        patient_id TEXT,
        entry_date TEXT NOT NULL,
        lineup_hash TEXT NOT NULL,
        slots_json TEXT NOT NULL,
        verdict_json TEXT NOT NULL,
        barrier_friction_index INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_lineup_snapshots_session_date
        ON patient_routine_lineup_snapshots(session_id, entry_date);

      CREATE INDEX IF NOT EXISTS idx_lineup_snapshots_hash
        ON patient_routine_lineup_snapshots(lineup_hash);
    `);

    const addCol = (sql) => {
      try {
        db.prepare(sql).run();
      } catch (_) {}
    };
    addCol(
      "ALTER TABLE patient_onboarding_step3_products ADD COLUMN ingredient_canonical_ids_json TEXT"
    );
    addCol("ALTER TABLE patient_onboarding_step3_products ADD COLUMN barcode TEXT");
    addCol("ALTER TABLE patient_onboarding_step3_products ADD COLUMN ingredients_text TEXT");
    addCol(
      "ALTER TABLE patient_onboarding_step3_products ADD COLUMN verdict_status TEXT DEFAULT 'unknown'"
    );
    addCol("ALTER TABLE patient_onboarding_step3_products ADD COLUMN kept_despite_conflict INTEGER DEFAULT 0");
  },
};
