'use strict';

/**
 * Progress Kelly nudge + rate-limit state — one table per (patient, mark).
 * Explicitly does NOT store body text or any prior Kelly prose.
 *
 * Two independent timers on the same row (do not conflate):
 * - last_message_type + last_message_date → 3-day same-type suppress (repeat-nudge UX)
 * - last_attempt_at → 5-minute min-interval rate limit (cost / double-submit)
 * Fixing one does not cover the other.
 */

const MESSAGE_TYPES = new Set(['observation', 'prompt', 'milestone']);

/** Rolling window (days) for soft repeat-nudge avoidance. */
const REPEAT_NUDGE_WINDOW_DAYS = 3;

/**
 * Min interval between generations for the same (patient_id, mark_id).
 * Decision #18: server-side, not client-only. Default 5 minutes — blocks
 * rapid Progress re-opens without blocking a return after a photo a few
 * minutes later. Override: PROGRESS_KELLY_MIN_INTERVAL_MINUTES.
 */
const DEFAULT_MIN_INTERVAL_MINUTES = 5;

function getMinIntervalMinutes() {
  const raw = process.env.PROGRESS_KELLY_MIN_INTERVAL_MINUTES;
  if (raw == null || String(raw).trim() === '') return DEFAULT_MIN_INTERVAL_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MIN_INTERVAL_MINUTES;
  return n;
}

function ensureNudgeTable(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    return false;
  }
  require('../migrations/078_progress_kelly_nudge_state').up(db);
  return true;
}

function isoDayOnly(value) {
  if (value == null || value === '') return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function isoTimestamp(value = null) {
  if (value != null && String(value).trim()) {
    const d = new Date(String(value).trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function emptyNudgeState() {
  return {
    last_message_type: null,
    last_message_date: null,
    last_attempt_at: null,
  };
}

function getLastNudge(db, { patientId, markId }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const mid = markId != null ? String(markId).trim() : '';
  if (!pid || !mid) return emptyNudgeState();
  if (!ensureNudgeTable(db)) return emptyNudgeState();
  const row = db
    .prepare(
      `SELECT last_message_type, last_message_date, last_attempt_at
       FROM progress_kelly_nudge_state
       WHERE patient_id = ? AND mark_id = ?`,
    )
    .get(pid, mid);
  if (!row) return emptyNudgeState();
  return {
    last_message_type: row.last_message_type || null,
    last_message_date: isoDayOnly(row.last_message_date),
    last_attempt_at: row.last_attempt_at || null,
  };
}

/**
 * Persist type + date after a successful non-fallback generation.
 * Also advances last_attempt_at (rate-limit clock).
 */
function recordLastNudge(db, { patientId, markId, messageType, messageDate = null, attemptedAt = null }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const mid = markId != null ? String(markId).trim() : '';
  const type = String(messageType || '').trim();
  if (!pid || !mid || !MESSAGE_TYPES.has(type)) return false;
  if (!ensureNudgeTable(db)) return false;
  const day = isoDayOnly(messageDate) || new Date().toISOString().slice(0, 10);
  const at = isoTimestamp(attemptedAt);
  db.prepare(
    `INSERT INTO progress_kelly_nudge_state (
       patient_id, mark_id, last_message_type, last_message_date, last_attempt_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(patient_id, mark_id) DO UPDATE SET
       last_message_type = excluded.last_message_type,
       last_message_date = excluded.last_message_date,
       last_attempt_at = excluded.last_attempt_at,
       updated_at = datetime('now')`,
  ).run(pid, mid, type, day, at);
  return true;
}

/**
 * Advance rate-limit clock only (no message_type change).
 * Used after fallbacks / suppress paths that still consumed a generation attempt.
 * Do NOT call for rate_limited responses.
 */
function recordLastAttempt(db, { patientId, markId, attemptedAt = null }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const mid = markId != null ? String(markId).trim() : '';
  if (!pid || !mid) return false;
  if (!ensureNudgeTable(db)) return false;
  const at = isoTimestamp(attemptedAt);
  db.prepare(
    `INSERT INTO progress_kelly_nudge_state (
       patient_id, mark_id, last_message_type, last_message_date, last_attempt_at, updated_at
     ) VALUES (?, ?, NULL, NULL, ?, datetime('now'))
     ON CONFLICT(patient_id, mark_id) DO UPDATE SET
       last_attempt_at = excluded.last_attempt_at,
       updated_at = datetime('now')`,
  ).run(pid, mid, at);
  return true;
}

function daysBetween(isoA, isoB) {
  const a = isoDayOnly(isoA);
  const b = isoDayOnly(isoB);
  if (!a || !b) return null;
  const ms =
    Date.parse(`${b}T12:00:00.000Z`) - Date.parse(`${a}T12:00:00.000Z`);
  return Math.round(ms / 86400000);
}

/**
 * Soft UX check (not Pass 1/2): same message_type within rolling window?
 */
function isRepeatNudgeWithinWindow(
  { last_message_type, last_message_date },
  nextMessageType,
  { todayIso = null, windowDays = REPEAT_NUDGE_WINDOW_DAYS } = {},
) {
  if (!last_message_type || !last_message_date) return false;
  if (String(last_message_type) !== String(nextMessageType)) return false;
  const today = isoDayOnly(todayIso) || new Date().toISOString().slice(0, 10);
  const delta = daysBetween(last_message_date, today);
  if (delta == null) return false;
  return delta >= 0 && delta < windowDays;
}

/**
 * Server-side min-interval check (Decision #18).
 * Uses last_attempt_at from the same nudge-state row — not a second table.
 * Day-only last_message_date is insufficient for minute grain; last_attempt_at is required.
 */
function isWithinRateLimitWindow(
  { last_attempt_at } = {},
  { nowIso = null, intervalMinutes = null } = {},
) {
  if (!last_attempt_at) return false;
  const lastMs = Date.parse(String(last_attempt_at));
  if (!Number.isFinite(lastMs)) return false;
  const nowMs = nowIso != null ? Date.parse(String(nowIso)) : Date.now();
  if (!Number.isFinite(nowMs)) return false;
  const mins = intervalMinutes != null ? Number(intervalMinutes) : getMinIntervalMinutes();
  if (!Number.isFinite(mins) || mins <= 0) return false;
  const elapsedMin = (nowMs - lastMs) / 60000;
  return elapsedMin >= 0 && elapsedMin < mins;
}

/** Account purge / patient wipe — all marks for this patient. */
function clearNudgeStateForPatient(db, { patientId }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  if (!pid) return 0;
  if (!ensureNudgeTable(db)) return 0;
  const info = db
    .prepare(`DELETE FROM progress_kelly_nudge_state WHERE patient_id = ?`)
    .run(pid);
  return Number(info.changes) || 0;
}

/**
 * Per-mark cleanup helper — NOT currently called from any product path.
 *
 * Search (2026-07-21): no route/UI deletes a single mark/compare_group without
 * full account deletion. Do NOT treat this export as evidence of mark-level
 * purge coverage until a mark-delete caller exists AND an evidence test asserts
 * before=1/after=0 for that mark while leaving other marks' rows intact.
 *
 * Wire this in when per-mark delete ships (same pattern as
 * clearNudgeStateForPatient → purgePatientAccount).
 */
function clearNudgeStateForMark(db, { patientId, markId }) {
  const pid = patientId != null ? String(patientId).trim() : '';
  const mid = markId != null ? String(markId).trim() : '';
  if (!pid || !mid) return 0;
  if (!ensureNudgeTable(db)) return 0;
  const info = db
    .prepare(
      `DELETE FROM progress_kelly_nudge_state WHERE patient_id = ? AND mark_id = ?`,
    )
    .run(pid, mid);
  return Number(info.changes) || 0;
}

module.exports = {
  REPEAT_NUDGE_WINDOW_DAYS,
  DEFAULT_MIN_INTERVAL_MINUTES,
  MESSAGE_TYPES,
  ensureNudgeTable,
  getLastNudge,
  recordLastNudge,
  recordLastAttempt,
  clearNudgeStateForPatient,
  clearNudgeStateForMark,
  isRepeatNudgeWithinWindow,
  isWithinRateLimitWindow,
  getMinIntervalMinutes,
  isoDayOnly,
  isoTimestamp,
};
