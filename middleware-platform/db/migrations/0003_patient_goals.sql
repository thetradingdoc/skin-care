-- Patient goals for consumer journey agent (Phase 4)

CREATE TABLE IF NOT EXISTS patient_goals (
  id TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_ref TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_goals_owner ON patient_goals(owner_key);
CREATE INDEX IF NOT EXISTS idx_patient_goals_status ON patient_goals(owner_key, status);
