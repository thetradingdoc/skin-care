'use strict';

/** SQLite fallback tables for consumer v3 when POSTGRES_URL is unset (local dev / CI). */
function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_consumer_profiles (
      owner_key TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      journey_modes_json TEXT NOT NULL DEFAULT '[]',
      primary_mode TEXT,
      onboarding_complete INTEGER NOT NULL DEFAULT 0,
      bio_calibration_complete INTEGER NOT NULL DEFAULT 0,
      needs_first_photo INTEGER NOT NULL DEFAULT 0,
      chosen_at TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_patient_consumer_profiles_session ON patient_consumer_profiles(session_id);
    CREATE INDEX IF NOT EXISTS idx_patient_consumer_profiles_patient ON patient_consumer_profiles(patient_id);

    CREATE TABLE IF NOT EXISTS patient_spots (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      label TEXT NOT NULL,
      body_region TEXT NOT NULL,
      created_at TEXT NOT NULL,
      archived_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_patient_spots_owner ON patient_spots(owner_key);

    CREATE TABLE IF NOT EXISTS patient_spot_snapshots (
      id TEXT PRIMARY KEY,
      spot_id TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      storage_ref TEXT,
      thumb_storage_ref TEXT,
      journal_entry_id TEXT,
      analysis_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_patient_spot_snapshots_spot ON patient_spot_snapshots(spot_id);
  `);
}

module.exports = { up };
