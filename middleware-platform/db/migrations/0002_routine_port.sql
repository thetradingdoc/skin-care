-- Routine / bio / shelf port tables for Postgres (DATA_STORE=postgres migration wave)

CREATE TABLE IF NOT EXISTS patient_routine_templates (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  patient_id TEXT,
  name TEXT,
  concern_id TEXT,
  start_date TEXT,
  program_week INTEGER,
  duration_weeks INTEGER,
  metadata_json TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_bio_profiles (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  patient_id TEXT,
  conditions_json TEXT,
  prescriptions_json TEXT,
  sensitivity TEXT,
  fitzpatrick TEXT,
  zip TEXT,
  profile_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_onboarding_step3_products (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  patient_id TEXT,
  selection_mode TEXT,
  catalog_product_id TEXT,
  custom_product_name TEXT,
  category TEXT,
  usage_time TEXT,
  goal TEXT,
  ingredients_text TEXT,
  barcode TEXT,
  ingredient_canonical_ids_json TEXT,
  key_ingredients TEXT,
  inventory_status TEXT,
  verdict_status TEXT,
  kept_despite_conflict BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_session ON patient_routine_templates(session_id);
CREATE INDEX IF NOT EXISTS idx_pbp_session ON patient_bio_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_shelf_session ON patient_onboarding_step3_products(session_id);
