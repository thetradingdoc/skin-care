#!/usr/bin/env node
'use strict';

/**
 * Idempotent backfill: routine daily photos → patient_journal_entries.
 * Usage: node scripts/backfill-journal-from-routine.js
 */

const db = require('../database');
const { ensureRoutineTables } = require('../lib/patient-routine-db');
const { ensureJournalTables } = require('../lib/patient-journal-db');
const { upsertEntry, getEntryForDate } = require('../repositories/patient-journal-repo');

function parseSkinReport(raw) {
  if (!raw) return { tags: [], note: null };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const tags = Array.isArray(parsed?.symptom_tags) ? parsed.symptom_tags : [];
    return { tags, note: parsed?.assistant_summary || null };
  } catch {
    return { tags: [], note: null };
  }
}

function run() {
  ensureRoutineTables();
  ensureJournalTables();

  const rows = db.db
    .prepare(
      `SELECT e.id AS daily_entry_id, e.patient_id, e.session_id, e.entry_date, e.skin_report, e.notes,
              m.media_url
       FROM patient_routine_daily_entries e
       LEFT JOIN patient_routine_daily_media m ON m.daily_entry_id = e.id
       WHERE m.media_url IS NOT NULL
       ORDER BY e.entry_date ASC`,
    )
    .all();

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = getEntryForDate(db.db, {
      patientId: row.patient_id,
      sessionId: row.session_id,
      entryDate: row.entry_date,
    });
    if (existing?.photo_storage_ref) {
      skipped += 1;
      continue;
    }
    const { tags, note } = parseSkinReport(row.skin_report);
    upsertEntry(db.db, {
      patientId: row.patient_id,
      sessionId: row.session_id,
      entryDate: row.entry_date,
      photoStorageRef: row.media_url,
      conditionTags: tags,
      note: row.notes || note,
      source: 'routine_backfill',
      routineDailyEntryId: row.daily_entry_id,
    });
    created += 1;
  }

  console.log(`Journal backfill complete. created=${created} skipped=${skipped} total_media_rows=${rows.length}`);
}

run();
