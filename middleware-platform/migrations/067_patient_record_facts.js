'use strict';

/**
 * P2.01 — Flexible patient_record_facts (six tags via structured_json).
 *
 * Design choices:
 * - patient_id nullable: P2.20 anonymous→claim binding must not be blocked by NOT NULL.
 * - session_id nullable but indexed: authenticated sessions still key ownership today.
 * - request_id present now. Early 067 builds briefly had GLOBAL unique idx_prf_request_id;
 *   that index is no longer created here. P2.28 migration 068 drops it if present and replaces
 *   with UNIQUE(owner_key, request_id).
 * - compare_group_id nullable column (not only inside JSON): mark compare queries (P5.11–12)
 *   need an indexed column; P3.24 creates values.
 * - storage_key + storage_provider separate from storage_ref: P2.29 signed URLs need opaque keys.
 * - SQLite TEXT for JSON (structured_json) matching journal/spots pattern in this codebase.
 */

function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_record_facts (
      id TEXT PRIMARY KEY,
      patient_id TEXT,
      session_id TEXT,
      tag TEXT NOT NULL,
      media_type TEXT,
      ai_or_manual TEXT NOT NULL,
      storage_ref TEXT,
      storage_provider TEXT,
      storage_key TEXT,
      structured_json TEXT NOT NULL DEFAULT '{}',
      raw_extract_text TEXT,
      source_language TEXT,
      display_language TEXT,
      compare_group_id TEXT,
      request_id TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (tag IN ('skin','bill','prescription','mark','lab','other')),
      CHECK (media_type IS NULL OR media_type IN ('photo','pdf')),
      CHECK (ai_or_manual IN ('ai','manual'))
    );
    CREATE INDEX IF NOT EXISTS idx_prf_patient_created
      ON patient_record_facts(patient_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_prf_session_created
      ON patient_record_facts(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_prf_tag_created
      ON patient_record_facts(tag, created_at);
    CREATE INDEX IF NOT EXISTS idx_prf_compare_group
      ON patient_record_facts(compare_group_id);
    -- request_id uniqueness is owner-scoped in 068 (idx_prf_owner_request_id).
    -- Do NOT recreate a global idx_prf_request_id here — ensureTables re-runs 067.
  `);
}

module.exports = { id: '067_patient_record_facts', up };
