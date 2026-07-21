'use strict';

/**
 * Progress Kelly tool implementations (Step 1b).
 * Confirmed mark facts via marks-compare only — never patient_spots.
 * Counts only — no adherence percentages, no week fields.
 */

const { getCompareGroupTimeline } = require('./medical-tracker-domain/marks-compare');

function isoDayOnly(value) {
  if (value == null || value === '') return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function resolvePatientId(userId, ctxPatientId) {
  const fromArg = userId != null ? String(userId).trim() : '';
  if (fromArg) return fromArg;
  const fromCtx = ctxPatientId != null ? String(ctxPatientId).trim() : '';
  return fromCtx || null;
}

function windowBounds(windowDays, todayIso) {
  const end = isoDayOnly(todayIso) || new Date().toISOString().slice(0, 10);
  const n = Math.max(1, Math.min(365, Number(windowDays) || 30));
  const d = new Date(`${end}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - (n - 1));
  return { start: d.toISOString().slice(0, 10), end, window_days: n };
}

/**
 * mark_id is compare_group_id (Progress/Compare identity).
 * Returns dates / location / label only — no media, no vision.
 */
function getMarkFacts(db, { markId, patientId } = {}) {
  const compareGroupId = markId != null ? String(markId).trim() : '';
  if (!compareGroupId) {
    return { success: false, error: 'mark_id_required' };
  }
  if (!patientId) {
    return { success: false, error: 'patient_id_required' };
  }

  let timeline;
  try {
    timeline = getCompareGroupTimeline(db, {
      patientId,
      compareGroupId,
    });
  } catch (e) {
    return {
      success: false,
      error: e.code || e.message || 'mark_facts_failed',
    };
  }

  const facts = (timeline.facts || []).map((f) => ({
    id: f.id,
    date: f.date || null,
    location: f.body_location || null,
    // marks-compare has note/body_location, not a dedicated label column
    label: f.note || f.body_location || null,
    compare_group_id: f.compare_group_id || compareGroupId,
  }));

  return {
    success: true,
    mark_id: compareGroupId,
    facts,
  };
}

/**
 * Active protocol template + daily entries/item logs in window.
 * Counts only — no percentage adherence field.
 */
function getProtocolAdherence(db, { userId, patientId, sessionId, windowDays = 30, todayIso = null } = {}) {
  const pid = resolvePatientId(userId, patientId);
  if (!pid && !sessionId) {
    return { success: false, error: 'owner_required' };
  }

  const { start, end, window_days } = windowBounds(windowDays, todayIso);

  let template = null;
  try {
    if (pid) {
      template = db
        .prepare(
          `SELECT id, name, start_date, patient_id, session_id
           FROM patient_routine_templates
           WHERE patient_id = ? AND is_active = 1
           ORDER BY datetime(updated_at) DESC LIMIT 1`,
        )
        .get(pid);
    }
    if (!template && sessionId) {
      template = db
        .prepare(
          `SELECT id, name, start_date, patient_id, session_id
           FROM patient_routine_templates
           WHERE session_id = ? AND is_active = 1
           ORDER BY datetime(updated_at) DESC LIMIT 1`,
        )
        .get(sessionId);
    }
  } catch (e) {
    return { success: false, error: e.message || 'protocol_query_failed' };
  }

  if (!template) {
    return {
      success: true,
      window_days,
      window_start: start,
      window_end: end,
      template_id: null,
      logged_days: 0,
      daily_entry_count: 0,
      item_log_count: 0,
      item_completed_count: 0,
    };
  }

  const entries = db
    .prepare(
      `SELECT id, entry_date FROM patient_routine_daily_entries
       WHERE template_id = ?
         AND date(entry_date) >= date(?)
         AND date(entry_date) <= date(?)`,
    )
    .all(template.id, start, end);

  const distinctDays = new Set(
    entries.map((e) => isoDayOnly(e.entry_date)).filter(Boolean),
  );

  let itemLogCount = 0;
  let itemCompletedCount = 0;
  if (entries.length) {
    const placeholders = entries.map(() => '?').join(',');
    const logs = db
      .prepare(
        `SELECT completed FROM patient_routine_daily_item_logs
         WHERE daily_entry_id IN (${placeholders})`,
      )
      .all(...entries.map((e) => e.id));
    itemLogCount = logs.length;
    itemCompletedCount = logs.filter((l) => Number(l.completed) === 1).length;
  }

  return {
    success: true,
    window_days,
    window_start: start,
    window_end: end,
    template_id: template.id,
    logged_days: distinctDays.size,
    daily_entry_count: entries.length,
    item_log_count: itemLogCount,
    item_completed_count: itemCompletedCount,
  };
}

/**
 * Confirmed mark-fact day counts for a compare_group_id.
 * Same confirmed_at filter pattern as progress-aggregates.js (no exported helper there).
 */
function getDayCounts(db, { userId, patientId, markId } = {}) {
  const pid = resolvePatientId(userId, patientId);
  const compareGroupId = markId != null ? String(markId).trim() : '';
  if (!pid) {
    return { success: false, error: 'patient_id_required' };
  }
  if (!compareGroupId) {
    return { success: false, error: 'mark_id_required' };
  }

  // progress-aggregates.js has no per-mark day-count export — wrap marks-compare timeline.
  let facts = [];
  try {
    const timeline = getCompareGroupTimeline(db, {
      patientId: pid,
      compareGroupId,
    });
    facts = timeline.facts || [];
  } catch (e) {
    return {
      success: false,
      error: e.code || e.message || 'day_counts_failed',
    };
  }

  const days = new Set();
  for (const f of facts) {
    const day =
      isoDayOnly(f.date) ||
      isoDayOnly(f.confirmed_at) ||
      null;
    if (day) days.add(day);
  }

  // Repetition-avoidance facts only (type + date). Never prior message body.
  const { getLastNudge } = require('./progress-kelly-nudge-state');
  const nudge = getLastNudge(db, { patientId: pid, markId: compareGroupId });

  return {
    success: true,
    mark_id: compareGroupId,
    fact_count: facts.length,
    distinct_day_count: days.size,
    last_message_type: nudge.last_message_type,
    last_message_date: nudge.last_message_date,
  };
}

module.exports = {
  getMarkFacts,
  getProtocolAdherence,
  getDayCounts,
  isoDayOnly,
};
