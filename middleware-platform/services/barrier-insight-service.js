'use strict';

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

  for (let i = 0; i < rows.length - 1; i += 1) {
    const curr = Number(rows[i].barrier_friction_index) || 0;
    const prev = Number(rows[i + 1].barrier_friction_index) || 0;
    const drop = prev - curr;
    if (drop > maxDrop) {
      maxDrop = drop;
      dipRow = rows[i];
      priorRow = rows[i + 1];
    }
  }

  if (!dipRow || maxDrop < 10) return null;

  let verdict = {};
  try {
    verdict = JSON.parse(dipRow.verdict_json || '{}');
  } catch (_) {}

  const topConflict = (verdict.conflicts || [])[0];
  const title = topConflict
    ? `${topConflict.ingredient_a} + ${topConflict.ingredient_b}`
    : 'Aggressive actives';

  return {
    dip_date: dipRow.entry_date,
    prior_date: priorRow?.entry_date,
    drop_points: maxDrop,
    title,
    message: `Your barrier dropped ${maxDrop} points around ${dipRow.entry_date}. ${
      topConflict?.notes || 'Review products used that day.'
    }`,
  };
}

module.exports = { findBarrierDip };
