'use strict';

const { resolveOwnerKey } = require('../db/client');
const { normalizeConditionTags } = require('../lib/journal-condition-tags');
const { levelToRank } = require('../lib/journal-severity');

function entryId() {
  return `jrnl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function rowToEntry(row) {
  if (!row) return null;
  let conditionTags = [];
  try {
    conditionTags = normalizeConditionTags(
      row.condition_tags_json ? JSON.parse(String(row.condition_tags_json)) : [],
    );
  } catch {
    conditionTags = [];
  }
  const dryness_level = row.dryness_level || null;
  const breakout_level = row.breakout_level || null;
  return {
    id: row.id,
    owner_key: row.owner_key,
    patient_id: row.patient_id || null,
    session_id: row.session_id,
    entry_date: row.entry_date,
    photo_storage_ref: row.photo_storage_ref || null,
    condition_tags: conditionTags,
    note: row.note || null,
    source: row.source || 'standalone',
    routine_daily_entry_id: row.routine_daily_entry_id || null,
    dryness_level,
    breakout_level,
    calm_flag: row.calm_flag || null,
    dryness_score: row.dryness_score != null ? Number(row.dryness_score) : null,
    breakout_score: row.breakout_score != null ? Number(row.breakout_score) : null,
    advanced_severity: Number(row.advanced_severity) === 1,
    dryness_rank: levelToRank(dryness_level),
    breakout_rank: levelToRank(breakout_level),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function upsertEntry(sqliteDb, {
  patientId,
  sessionId,
  entryDate,
  photoStorageRef,
  conditionTags,
  note,
  source,
  routineDailyEntryId,
  drynessLevel,
  breakoutLevel,
  calmFlag,
  drynessScore,
  breakoutScore,
  advancedSeverity,
}) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey || !entryDate) throw new Error('owner_key_and_date_required');

  const tags = normalizeConditionTags(conditionTags);
  const existing = sqliteDb
    .prepare(`SELECT * FROM patient_journal_entries WHERE owner_key = ? AND entry_date = ? LIMIT 1`)
    .get(ownerKey, entryDate);

  const now = new Date().toISOString();
  const photoRef =
    photoStorageRef != null && String(photoStorageRef).trim()
      ? String(photoStorageRef).trim()
      : existing?.photo_storage_ref || null;
  const mergedTags = tags.length ? tags : rowToEntry(existing)?.condition_tags || [];
  const mergedNote = note !== undefined ? (note != null ? String(note) : null) : existing?.note || null;
  const mergedSource = source || existing?.source || 'standalone';
  const mergedRoutineId =
    routineDailyEntryId || existing?.routine_daily_entry_id || null;

  const mergedDryness =
    drynessLevel !== undefined ? drynessLevel : existing?.dryness_level || null;
  const mergedBreakout =
    breakoutLevel !== undefined ? breakoutLevel : existing?.breakout_level || null;
  const mergedCalm = calmFlag !== undefined ? calmFlag : existing?.calm_flag || null;
  const mergedDryScore =
    drynessScore !== undefined ? drynessScore : existing?.dryness_score ?? null;
  const mergedBreakScore =
    breakoutScore !== undefined ? breakoutScore : existing?.breakout_score ?? null;
  const mergedAdvanced =
    advancedSeverity !== undefined
      ? advancedSeverity
        ? 1
        : 0
      : Number(existing?.advanced_severity) || 0;

  if (existing) {
    sqliteDb
      .prepare(
        `UPDATE patient_journal_entries SET
          patient_id = COALESCE(?, patient_id),
          session_id = ?,
          photo_storage_ref = COALESCE(?, photo_storage_ref),
          condition_tags_json = ?,
          note = ?,
          source = ?,
          routine_daily_entry_id = COALESCE(?, routine_daily_entry_id),
          dryness_level = ?,
          breakout_level = ?,
          calm_flag = ?,
          dryness_score = ?,
          breakout_score = ?,
          advanced_severity = ?,
          updated_at = ?
        WHERE id = ?`,
      )
      .run(
        patientId || null,
        sessionId,
        photoRef,
        JSON.stringify(mergedTags),
        mergedNote,
        mergedSource,
        mergedRoutineId,
        mergedDryness,
        mergedBreakout,
        mergedCalm,
        mergedDryScore,
        mergedBreakScore,
        mergedAdvanced,
        now,
        existing.id,
      );
    return rowToEntry(sqliteDb.prepare(`SELECT * FROM patient_journal_entries WHERE id = ?`).get(existing.id));
  }

  const id = entryId();
  sqliteDb
    .prepare(
      `INSERT INTO patient_journal_entries (
        id, owner_key, patient_id, session_id, entry_date,
        photo_storage_ref, condition_tags_json, note, source,
        routine_daily_entry_id,
        dryness_level, breakout_level, calm_flag,
        dryness_score, breakout_score, advanced_severity,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      ownerKey,
      patientId || null,
      sessionId,
      entryDate,
      photoRef,
      JSON.stringify(mergedTags),
      mergedNote,
      mergedSource,
      mergedRoutineId,
      mergedDryness,
      mergedBreakout,
      mergedCalm,
      mergedDryScore,
      mergedBreakScore,
      mergedAdvanced,
      now,
      now,
    );
  return rowToEntry(sqliteDb.prepare(`SELECT * FROM patient_journal_entries WHERE id = ?`).get(id));
}

function getEntryForDate(sqliteDb, { patientId, sessionId, entryDate }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey || !entryDate) return null;
  const row = sqliteDb
    .prepare(`SELECT * FROM patient_journal_entries WHERE owner_key = ? AND entry_date = ? LIMIT 1`)
    .get(ownerKey, entryDate);
  return rowToEntry(row);
}

function getByDateRange(sqliteDb, { patientId, sessionId, startIso, endIso }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return [];
  const rows = sqliteDb
    .prepare(
      `SELECT * FROM patient_journal_entries
       WHERE owner_key = ? AND entry_date BETWEEN ? AND ?
       ORDER BY entry_date ASC`,
    )
    .all(ownerKey, startIso, endIso);
  return rows.map(rowToEntry);
}

function getYesterdaySeverity(sqliteDb, { patientId, sessionId, todayIso }) {
  const d = new Date(`${todayIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const yesterday = d.toISOString().slice(0, 10);
  return getEntryForDate(sqliteDb, { patientId, sessionId, entryDate: yesterday });
}

function countLoggedDays(sqliteDb, { patientId, sessionId }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return 0;
  const row = sqliteDb
    .prepare(
      `SELECT COUNT(*) AS n FROM patient_journal_entries
       WHERE owner_key = ? AND (photo_storage_ref IS NOT NULL OR condition_tags_json IS NOT NULL AND condition_tags_json != '[]' OR note IS NOT NULL AND note != '' OR dryness_level IS NOT NULL)`,
    )
    .get(ownerKey);
  return Number(row?.n) || 0;
}

function computeStreak(sqliteDb, { patientId, sessionId, todayIso }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return 0;

  const rows = sqliteDb
    .prepare(
      `SELECT entry_date FROM patient_journal_entries
       WHERE owner_key = ?
         AND (
           photo_storage_ref IS NOT NULL
           OR (condition_tags_json IS NOT NULL AND condition_tags_json != '[]')
           OR (note IS NOT NULL AND note != '')
           OR dryness_level IS NOT NULL
         )
       ORDER BY entry_date DESC
       LIMIT 120`,
    )
    .all(ownerKey);

  const loggedDates = new Set(rows.map((r) => r.entry_date));
  if (!loggedDates.size) return 0;

  let streakDays = 0;
  let cursor = new Date(`${todayIso}T12:00:00.000Z`);
  if (!loggedDates.has(todayIso)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  for (let i = 0; i < 120; i += 1) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!loggedDates.has(iso)) break;
    streakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streakDays;
}

function listRecentEntries(sqliteDb, { patientId, sessionId, limit = 30 }) {
  const ownerKey = resolveOwnerKey({ patientId, sessionId });
  if (!ownerKey) return [];
  const rows = sqliteDb
    .prepare(
      `SELECT * FROM patient_journal_entries
       WHERE owner_key = ?
       ORDER BY entry_date DESC
       LIMIT ?`,
    )
    .all(ownerKey, Math.max(1, Math.min(120, limit)));
  return rows.map(rowToEntry);
}

module.exports = {
  upsertEntry,
  getEntryForDate,
  getByDateRange,
  getYesterdaySeverity,
  countLoggedDays,
  computeStreak,
  listRecentEntries,
  rowToEntry,
};
