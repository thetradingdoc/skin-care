-- TOUCH-039 postgres path — journal severity enums (mirror SQLite 060)
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS dryness_level TEXT
  CHECK (dryness_level IS NULL OR dryness_level IN ('low', 'some', 'a_lot'));
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS breakout_level TEXT
  CHECK (breakout_level IS NULL OR breakout_level IN ('low', 'some', 'a_lot'));
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS calm_flag TEXT
  CHECK (calm_flag IS NULL OR calm_flag IN ('yes', 'no'));
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS dryness_score INTEGER
  CHECK (dryness_score IS NULL OR (dryness_score >= 1 AND dryness_score <= 10));
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS breakout_score INTEGER
  CHECK (breakout_score IS NULL OR (breakout_score >= 1 AND breakout_score <= 10));
ALTER TABLE patient_journal_entries ADD COLUMN IF NOT EXISTS advanced_severity BOOLEAN NOT NULL DEFAULT FALSE;
