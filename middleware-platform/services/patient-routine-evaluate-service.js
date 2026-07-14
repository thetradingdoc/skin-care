'use strict';

const { evaluateIngredientSafety } = require('./ingredient-ontology-resolver');
const { resolveSkinConflicts } = require('./skin-conflict-resolver');
const { getChunksForRoutineVerdict } = require('./ingredient-rag-chunks-service');
const { buildBioProfileContext } = require('./patient-bio-profile-service');
const {
  resolvePatientLineupSlots,
  resolveShelfToSlots,
  resolveTemplateToSlots,
  resolveShelfProductIngredients,
  extractActivesFromText,
} = require('./patient-lineup-resolver-service');
const { detectClassOverloads, computeBarrierMetrics, normId } = require('./barrier-load-calculator');
const { computeLineupHash } = require('../lib/lineup-hash');
const migration = require('../migrations/055_conflict_engine');

function ensureConflictEngineTables(db) {
  if (migration?.up) migration.up(db);
}

function overallToScore(overall, bfi) {
  const base =
    overall === 'hard_no' || overall === 'avoid'
      ? 18
      : overall === 'caution'
        ? 55
        : 85;
  return Math.max(0, Math.min(100, Math.round((base + bfi) / 2)));
}

function buildSpacingNotes(conflicts) {
  return (conflicts || [])
    .filter((c) => c.spacing_hours != null && Number(c.spacing_hours) > 0)
    .map((c) => ({
      ingredient_a: c.ingredient_a,
      ingredient_b: c.ingredient_b,
      spacing_hours: c.spacing_hours,
      message: `Wait ${c.spacing_hours} minutes between ${c.ingredient_a} and ${c.ingredient_b}.`,
    }));
}

function buildContraindicationAlerts(bioContext, slots) {
  const conditionIds = (bioContext.conditions || []).map((c) => c.id || c);
  const allText = JSON.stringify(slots);
  const ingredientFacts = extractActivesFromText(allText).map((name) => ({ name, roles: [] }));
  const safety = evaluateIngredientSafety({
    ingredientFacts,
    conditions: conditionIds.map((id) => ({ id })),
    secondarySignals: { pigment_risk: bioContext.fitzpatrick ? 'medium' : 'low' },
  });
  const skinConflicts = resolveSkinConflicts({
    message: allText,
    conditions: conditionIds.map((id) => ({ id })),
    ingredientFacts,
  });
  const alerts = [];
  for (const s of safety) {
    alerts.push({
      type: 'contraindication',
      severity: s.severity || 'medium',
      title: `${s.ingredient} — not ideal for your profile`,
      message: (s.why || []).join('; ') || s.safe_next_action,
      ingredient: s.ingredient,
    });
  }
  for (const sc of skinConflicts) {
    alerts.push({
      type: 'condition_conflict',
      severity: sc.severity || 'medium',
      title: sc.id.replace(/_/g, ' '),
      message: sc.next_action,
    });
  }
  return alerts;
}

function buildEvidenceSnippets(db, verdict) {
  const chunks = getChunksForRoutineVerdict(verdict, db);
  return chunks.slice(0, 4).map((c) => ({
    id: c.id,
    title: c.title,
    body: c.body,
    reason_code: c.reason_code || null,
  }));
}

function buildSuggestedFix(verdict, contraindicationAlerts) {
  const split = verdict.suggested_split;
  let message = 'Separate conflicting actives across AM and PM routines.';
  if (split?.am?.length && split?.pm?.length) {
    message = `Use ${split.am.slice(0, 2).join(', ')} in the morning and ${split.pm.slice(0, 2).join(', ')} at night.`;
  }
  if (contraindicationAlerts.length) {
    message = `${contraindicationAlerts[0].message || message} Consider gentler alternatives for your skin type.`;
  }
  return { title: 'The fix', message, suggested_split: split };
}

function isWashOffProduct(row) {
  const category = String(row?.category || '').toLowerCase();
  const name = String(row?.custom_product_name || row?.catalog_product_id || '').toLowerCase();
  return category.includes('cleanser') || category.includes('wash') || /cleanser|wash|soap|micellar/.test(name);
}

function perProductStatus(verdict, productRow) {
  const ids = resolveShelfProductIngredients(productRow);
  const conflictIds = new Set();
  for (const c of verdict.conflicts || []) {
    conflictIds.add(normId(c.ingredient_a));
    conflictIds.add(normId(c.ingredient_b));
  }
  const hit = ids.some((id) => conflictIds.has(id));
  if (hit) return 'conflict';
  if (!ids.length) return 'unknown';
  if (isWashOffProduct(productRow)) return 'watch';
  return 'safe';
}

function stepTouchesConflict(step, conflicts) {
  const ids = new Set((step.ingredient_ids || []).map(normId));
  for (const c of conflicts || []) {
    if (ids.has(normId(c.ingredient_a)) || ids.has(normId(c.ingredient_b))) return true;
  }
  return false;
}

function isActiveStep(step) {
  const name = String(step.product_name || '').toLowerCase();
  return /retinol|tretinoin|salicylic|glycolic|benzoyl|adapalene|acid|ascorbic/.test(name);
}

function loadCompletedStepNames(db, { sessionId, patientId }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const whereSql = patientId
    ? `WHERE (patient_id = ? OR session_id = ?) AND is_active = 1`
    : `WHERE session_id = ? AND is_active = 1`;
  const params = patientId ? [patientId, sessionId] : [sessionId];
  const template = db
    .prepare(`SELECT id FROM patient_routine_templates ${whereSql} ORDER BY datetime(updated_at) DESC LIMIT 1`)
    .get(...params);
  if (!template) return new Set();

  const entry = db
    .prepare(`SELECT id FROM patient_routine_daily_entries WHERE template_id = ? AND entry_date = ? LIMIT 1`)
    .get(template.id, todayIso);
  if (!entry) return new Set();

  const items = db
    .prepare(`
      SELECT i.product_name
      FROM patient_routine_daily_item_logs l
      INNER JOIN patient_routine_template_items i ON i.id = l.template_item_id
      WHERE l.daily_entry_id = ? AND (l.completed = 1 OR l.completed = true)
    `)
    .all(entry.id);

  return new Set(
    items.map((row) => String(row.product_name || '').trim().toLowerCase()).filter(Boolean)
  );
}

function buildRoutineStepStates(db, { sessionId, patientId, slots, conflicts, bfi }) {
  const lowBarrier = Number(bfi) < 60;
  const template = resolveTemplateToSlots(db, { sessionId, patientId });
  const sourceSlots = template.slots?.length ? template.slots : slots || [];
  const completedNames = loadCompletedStepNames(db, { sessionId, patientId });
  const states = [];

  for (const slot of sourceSlots) {
    for (const st of slot.steps || []) {
      const conflict = stepTouchesConflict(st, conflicts);
      const skipActive = lowBarrier && isActiveStep(st);
      const warn = conflict || skipActive;
      const stepName = String(st.product_name || '').trim().toLowerCase();
      const done = !warn && stepName && completedNames.has(stepName);
      let sub = st.wash_off ? 'pH 5.5 · safe' : 'Apply as directed';
      if (conflict) sub = 'Ingredient conflict detected';
      else if (skipActive) sub = 'Skip tonight — barrier score too low';

      states.push({
        label: st.product_name || 'Routine step',
        sub,
        state: warn ? 'warn' : done ? 'done' : 'todo',
        usage_time: slot.time,
        product_name: st.product_name,
      });
    }
  }
  return states;
}

function filterForHighlight(allConflicts, alerts, highlightRow) {
  if (!highlightRow) {
    return { conflicts: allConflicts, contraindication_alerts: alerts };
  }
  const ids = new Set(resolveShelfProductIngredients(highlightRow).map(normId));
  const conflicts = allConflicts.filter((c) => ids.has(normId(c.ingredient_a)) || ids.has(normId(c.ingredient_b)));
  const contraindication_alerts = alerts.filter((a) => {
    const ing = normId(a.ingredient || '');
    return !ing || ids.has(ing) || conflicts.length > 0;
  });
  return { conflicts, contraindication_alerts };
}

function evaluatePatientLineup(db, { sessionId, patientId, slots: inputSlots, highlightProductId = null }) {
  const { runEvaluatePipelineSync } = require('./consumer-evaluate-nodes');
  return runEvaluatePipelineSync(db, {
    sessionId,
    patientId,
    slots: inputSlots,
    highlightProductId,
  });
}

function saveLineupSnapshot(db, { sessionId, patientId, entryDate, evaluateResult }) {
  ensureConflictEngineTables(db);
  db.prepare(`DELETE FROM patient_routine_lineup_snapshots WHERE session_id = ? AND entry_date = ?`).run(
    sessionId,
    entryDate
  );
  const id = `pls_${entryDate}_${sessionId.slice(0, 8)}`;
  db.prepare(`
    INSERT INTO patient_routine_lineup_snapshots (
      id, session_id, patient_id, entry_date, lineup_hash, slots_json, verdict_json, barrier_friction_index
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    patientId || null,
    entryDate,
    evaluateResult.lineup_hash,
    JSON.stringify(evaluateResult.slots || []),
    JSON.stringify({
      overall: evaluateResult.overall,
      compatibility_score: evaluateResult.compatibility_score,
      conflicts: evaluateResult.conflicts,
      barrier_friction_index: evaluateResult.barrier_friction_index,
    }),
    evaluateResult.barrier_friction_index
  );
}

module.exports = {
  ensureConflictEngineTables,
  evaluatePatientLineup,
  saveLineupSnapshot,
  buildSpacingNotes,
  buildRoutineStepStates,
  buildContraindicationAlerts,
  buildEvidenceSnippets,
  overallToScore,
  perProductStatus,
};
