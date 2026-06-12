'use strict';

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_goals (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target_ref TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      source TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_patient_goals_owner ON patient_goals(owner_key);
    CREATE INDEX IF NOT EXISTS idx_patient_goals_status ON patient_goals(owner_key, status);
  `);
}

module.exports = { up };
