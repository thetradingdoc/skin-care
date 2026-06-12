'use strict';

function parseVerdict(row) {
  try {
    return JSON.parse(row.verdict_json || '{}');
  } catch (_) {
    return {};
  }
}

function conflictTitle(verdict) {
  const topConflict = (verdict.conflicts || [])[0];
  if (!topConflict) return 'Aggressive actives';
  return `${topConflict.ingredient_a} + ${topConflict.ingredient_b}`;
}

function findBarrierDip(db, { sessionId, patientId, days = 14 }) {
  const migration = require('../migrations/055_conflict_engine');
  if (migration?.up) migration.up(db);

  const rows = db
    .prepare(`
      SELECT entry_date, barrier_friction_index, verdict_json, lineup_hash
      FROM patient_routine_lineup_snapshots
      WHERE session_id = ?
      ORDER BY entry_date DESC
      LIMIT ?
    `)
    .all(sessionId, Math.max(2, days));

  if (rows.length < 2) return null;

  let maxDrop = 0;
  let dipRow = null;
  let priorRow = null;

  const dipsByTitle = {};

  for (let i = 0; i < rows.length - 1; i += 1) {
    const curr = Number(rows[i].barrier_friction_index) || 0;
    const prev = Number(rows[i + 1].barrier_friction_index) || 0;
    const drop = prev - curr;
    if (drop >= 10) {
      const verdict = parseVerdict(rows[i]);
      const title = conflictTitle(verdict);
      dipsByTitle[title] = (dipsByTitle[title] || 0) + 1;
    }
    if (drop > maxDrop) {
      maxDrop = drop;
      dipRow = rows[i];
      priorRow = rows[i + 1];
    }
  }

  if (!dipRow || maxDrop < 10) return null;

  const verdict = parseVerdict(dipRow);
  const topConflict = (verdict.conflicts || [])[0];
  const title = conflictTitle(verdict);
  const patternCount = dipsByTitle[title] || 1;

  const patternSuffix =
    patternCount > 1
      ? ` This pattern has appeared ${patternCount} times.`
      : '';

  return {
    dip_date: dipRow.entry_date,
    prior_date: priorRow?.entry_date,
    drop_points: maxDrop,
    pattern_count: patternCount,
    title,
    message: `Your barrier dropped ${maxDrop} points the morning after.${patternSuffix} ${
      topConflict?.notes || 'Review products used that day.'
    }`.trim(),
  };
}

module.exports = { findBarrierDip };
