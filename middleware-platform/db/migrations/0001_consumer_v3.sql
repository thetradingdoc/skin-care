-- Consumer v3 tables (Postgres). Run via scripts/run-consumer-v3-migrate.js

CREATE TABLE IF NOT EXISTS patient_consumer_profiles (
  owner_key TEXT PRIMARY KEY,
  patient_id TEXT,
  session_id TEXT,
  journey_modes TEXT[] NOT NULL DEFAULT '{}',
  primary_mode TEXT,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  bio_calibration_complete BOOLEAN NOT NULL DEFAULT FALSE,
  needs_first_photo BOOLEAN NOT NULL DEFAULT FALSE,
  chosen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_consumer_profiles_session ON patient_consumer_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_patient_consumer_profiles_patient ON patient_consumer_profiles(patient_id);

CREATE TABLE IF NOT EXISTS patient_spots (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  label TEXT NOT NULL,
  body_region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_patient_spots_owner ON patient_spots(owner_key);

CREATE TABLE IF NOT EXISTS patient_spot_snapshots (
  id TEXT PRIMARY KEY,
  spot_id TEXT NOT NULL REFERENCES patient_spots(id) ON DELETE CASCADE,
  captured_at TIMESTAMPTZ NOT NULL,
  storage_ref TEXT,
  thumb_storage_ref TEXT,
  journal_entry_id TEXT,
  analysis_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_spot_snapshots_spot ON patient_spot_snapshots(spot_id);
