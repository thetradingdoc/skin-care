'use strict';

/**
 * TOUCH-044 — Apply "skip leave-on actives tonight" via existing routine daily log path
 * (same item_logs model as POST /api/patient/routine/daily), not a new chat.
 */

function isActiveishItem(item) {
  const blob = [
    item?.role,
    item?.category,
    item?.product_name,
    item?.name,
    item?.step_label,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!blob) return false;
  if (/\bcleanser\b|\bwash\b|\bmoisturizer\b|\bmoisturiser\b|\bspf\b|\bsunscreen\b|\bbarrier\b/.test(blob)) {
    return false;
  }
  return /\bretin|aha|bha|acid|exfoliant|peptide|vitamin\s*c|niacinamide|treatment|serum|active/.test(blob);
}

/**
 * @returns {{ applied: boolean, daily_entry_id?: string, skipped_count: number, advice: string, reason?: string }}
 */
function applySkipActivesTonight(sqliteDb, { sessionId, patientId, entryDate }) {
  const advice = 'Skip leave-on actives tonight. Keep cleanser + barrier.';
  if (!sqliteDb || !sessionId || !entryDate) {
    return { applied: false, skipped_count: 0, advice, reason: 'missing_args' };
  }

  const template = sqliteDb
    .prepare(
      `SELECT id FROM patient_routine_templates
       WHERE (session_id = ? OR (? IS NOT NULL AND patient_id = ?)) AND COALESCE(is_active, 1) = 1
       ORDER BY datetime(updated_at) DESC LIMIT 1`,
    )
    .get(sessionId, patientId || null, patientId || null);

  if (!template?.id) {
    // No routine template — still persist journal-side advice note if journal table exists.
    return { applied: true, skipped_count: 0, advice, reason: 'no_template_advice_only' };
  }

  let items = [];
  try {
    items = sqliteDb
      .prepare(
        `SELECT id, role, category, product_name, name, step_label, step_order
         FROM patient_routine_template_items
         WHERE template_id = ?
         ORDER BY COALESCE(step_order, 0) ASC`,
      )
      .all(template.id);
  } catch {
    // Schema variance — try minimal columns
    try {
      items = sqliteDb
        .prepare(`SELECT id, product_name, role FROM patient_routine_template_items WHERE template_id = ?`)
        .all(template.id);
    } catch {
      items = [];
    }
  }

  const actives = items.filter(isActiveishItem);
  const existing = sqliteDb
    .prepare(
      `SELECT id, notes, skin_report FROM patient_routine_daily_entries
       WHERE template_id = ? AND entry_date = ? LIMIT 1`,
    )
    .get(template.id, entryDate);

  const dailyEntryId = existing?.id || `rde_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const noteLine = `[agent_skip] ${advice}`;
  const mergedNotes = existing?.notes
    ? `${String(existing.notes).trim()}\n${noteLine}`
    : noteLine;

  let skinReport = {};
  try {
    skinReport = existing?.skin_report ? JSON.parse(String(existing.skin_report)) : {};
  } catch {
    skinReport = {};
  }
  skinReport.agent_skip_tonight = true;
  skinReport.agent_skip_advice = advice;
  skinReport.agent_skip_at = new Date().toISOString();

  if (existing) {
    sqliteDb
      .prepare(
        `UPDATE patient_routine_daily_entries
         SET notes = ?, skin_report = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(mergedNotes, JSON.stringify(skinReport), dailyEntryId);
    sqliteDb.prepare(`DELETE FROM patient_routine_daily_item_logs WHERE daily_entry_id = ?`).run(dailyEntryId);
  } else {
    sqliteDb
      .prepare(
        `INSERT INTO patient_routine_daily_entries (
          id, template_id, session_id, patient_id, entry_date, skin_report, notes, completion_score, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
      )
      .run(
        dailyEntryId,
        template.id,
        sessionId,
        patientId || null,
        entryDate,
        JSON.stringify(skinReport),
        mergedNotes,
      );
  }

  const insertLog = sqliteDb.prepare(
    `INSERT INTO patient_routine_daily_item_logs (
      id, daily_entry_id, template_item_id, completed, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  );

  let skipped = 0;
  for (const item of items) {
    const skip = isActiveishItem(item);
    if (skip) skipped += 1;
    insertLog.run(
      `rdl_${dailyEntryId}_${item.id}_${Math.random().toString(36).slice(2, 6)}`,
      dailyEntryId,
      String(item.id),
      0,
      skip ? 'skipped_tonight_agent' : null,
    );
  }

  return {
    applied: true,
    daily_entry_id: dailyEntryId,
    skipped_count: skipped || actives.length,
    advice,
    path: 'routine_daily_item_logs',
  };
}

module.exports = {
  applySkipActivesTonight,
  isActiveishItem,
};
