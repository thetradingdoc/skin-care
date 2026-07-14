'use strict';

/**
 * TOUCH-039 — dryness_level / breakout_level / calm_flag on journal entries.
 * Enums: low | some | a_lot ; calm_flag: yes | no
 */

function columnExists(db, table, col) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === col);
}

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_journal_entries (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      patient_id TEXT,
      session_id TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      photo_storage_ref TEXT,
      condition_tags_json TEXT,
      note TEXT,
      source TEXT NOT NULL DEFAULT 'standalone',
      routine_daily_entry_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(owner_key, entry_date)
    );
  `);

  if (!columnExists(db, 'patient_journal_entries', 'dryness_level')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN dryness_level TEXT`);
  }
  if (!columnExists(db, 'patient_journal_entries', 'breakout_level')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN breakout_level TEXT`);
  }
  if (!columnExists(db, 'patient_journal_entries', 'calm_flag')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN calm_flag TEXT`);
  }
  if (!columnExists(db, 'patient_journal_entries', 'dryness_score')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN dryness_score INTEGER`);
  }
  if (!columnExists(db, 'patient_journal_entries', 'breakout_score')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN breakout_score INTEGER`);
  }
  if (!columnExists(db, 'patient_journal_entries', 'advanced_severity')) {
    db.exec(`ALTER TABLE patient_journal_entries ADD COLUMN advanced_severity INTEGER NOT NULL DEFAULT 0`);
  }

  // CHECK-like enforcement via trigger (SQLite ignores inline CHECK on ALTER).
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_journal_severity_enums
    BEFORE INSERT ON patient_journal_entries
    BEGIN
      SELECT CASE
        WHEN NEW.dryness_level IS NOT NULL AND NEW.dryness_level NOT IN ('low','some','a_lot')
          THEN RAISE(ABORT, 'dryness_level must be low|some|a_lot')
        WHEN NEW.breakout_level IS NOT NULL AND NEW.breakout_level NOT IN ('low','some','a_lot')
          THEN RAISE(ABORT, 'breakout_level must be low|some|a_lot')
        WHEN NEW.calm_flag IS NOT NULL AND NEW.calm_flag NOT IN ('yes','no')
          THEN RAISE(ABORT, 'calm_flag must be yes|no')
      END;
    END;
  `);
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS trg_journal_severity_enums_upd
    BEFORE UPDATE ON patient_journal_entries
    BEGIN
      SELECT CASE
        WHEN NEW.dryness_level IS NOT NULL AND NEW.dryness_level NOT IN ('low','some','a_lot')
          THEN RAISE(ABORT, 'dryness_level must be low|some|a_lot')
        WHEN NEW.breakout_level IS NOT NULL AND NEW.breakout_level NOT IN ('low','some','a_lot')
          THEN RAISE(ABORT, 'breakout_level must be low|some|a_lot')
        WHEN NEW.calm_flag IS NOT NULL AND NEW.calm_flag NOT IN ('yes','no')
          THEN RAISE(ABORT, 'calm_flag must be yes|no')
      END;
    END;
  `);
}

module.exports = { up };
