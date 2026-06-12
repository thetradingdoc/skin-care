'use strict';

const { buildBioProfileContext } = require('./patient-bio-profile-service');
const { getConsumerProfile } = require('../repositories/consumer-profile-repo');
const {
  resolvePatientLineupSlots,
  resolveShelfToSlots,
  resolveShelfProductIngredients,
} = require('./patient-lineup-resolver-service');
const { detectClassOverloads, computeBarrierMetrics, normId } = require('./barrier-load-calculator');
const { computeLineupHash } = require('../lib/lineup-hash');
const {
  ensureConflictEngineTables,
  buildSpacingNotes,
  buildRoutineStepStates,
  overallToScore,
  perProductStatus,
  buildContraindicationAlerts,
  buildEvidenceSnippets,
} = require('./patient-routine-evaluate-service');

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

function filterForHighlight(allConflicts, alerts, highlightRow) {
  if (!highlightRow) {
    return { conflicts: allConflicts, contraindication_alerts: alerts };
  }
  const ids = new Set(resolveShelfProductIngredients(highlightRow).map(normId));
  const conflicts = allConflicts.filter(
    (c) => ids.has(normId(c.ingredient_a)) || ids.has(normId(c.ingredient_b)),
  );
  const contraindication_alerts = alerts.filter((a) => {
    const ing = normId(a.ingredient || '');
    return !ing || ids.has(ing) || conflicts.length > 0;
  });
  return { conflicts, contraindication_alerts };
}

function loadConsumerContextSync(state) {
  const db = state.sqlite_db;
  const { sessionId, patientId } = state;
  ensureConflictEngineTables(db);
  const bioContext = buildBioProfileContext(db, { sessionId, patientId });
  return { bioContext, consumerProfile: null };
}

async function loadConsumerContext(state) {
  const base = loadConsumerContextSync(state);
  const { sessionId, patientId } = state;
  const consumerProfile = await getConsumerProfile(state.sqlite_db, { sessionId, patientId });
  return { ...base, consumerProfile };
}

function resolveLineupSlots(state) {
  const db = state.sqlite_db;
  const { sessionId, patientId, slots: inputSlots } = state;
  let lineup = inputSlots
    ? { slots: inputSlots, source: 'manual', productRows: [] }
    : resolvePatientLineupSlots(db, { sessionId, patientId });

  if (!lineup.productRows?.length && sessionId && lineup.source !== 'manual') {
    lineup.productRows = resolveShelfToSlots(db, sessionId).productRows || [];
  }

  const highlightProductId = state.highlight_product_id || null;
  const highlightRow = highlightProductId
    ? (lineup.productRows || []).find((r) => String(r.id) === String(highlightProductId)) ||
      db
        .prepare(`SELECT * FROM patient_onboarding_step3_products WHERE session_id = ? AND id = ?`)
        .get(sessionId, highlightProductId)
    : null;

  return { lineup, highlightRow, highlight_product_id: highlightProductId };
}

function ingredientConflictNode(state) {
  const db = state.sqlite_db;
  const graph = require('../database').createIngredientConflictGraph?.();
  if (!graph) {
    return { graph_unavailable: true, error: 'conflict_graph_unavailable' };
  }

  const { lineup, highlightRow } = state;
  const productLabels = (lineup.productRows || []).map(
    (r) => r.custom_product_name || r.catalog_product_id || '',
  );
  productLabels.push(
    ...(lineup.slots || []).flatMap((s) => (s.steps || []).map((st) => st.product_name || '')),
  );

  const verdict = graph.evaluateRoutine(lineup.slots || []);
  const classOverloads = detectClassOverloads(lineup.slots, productLabels);
  let allConflicts = [...(verdict.conflicts || []), ...classOverloads];

  let overall = verdict.overall;
  if (classOverloads.some((c) => c.verdict === 'avoid')) overall = 'avoid';
  else if (classOverloads.length && overall === 'safe') overall = 'caution';

  return { verdict, allConflicts, overall, graph_unavailable: false };
}

function barrierMetricsNode(state) {
  const db = state.sqlite_db;
  const { sessionId, patientId, lineup, highlightRow, bioContext, verdict, allConflicts, overall } =
    state;

  const barrier = computeBarrierMetrics(lineup.slots, allConflicts);
  let contraindicationAlerts = bioContext.profile_complete
    ? buildContraindicationAlerts(bioContext, lineup.slots)
    : [];

  let resolvedOverall = overall;
  if (contraindicationAlerts.some((a) => a.severity === 'high') && resolvedOverall === 'safe') {
    resolvedOverall = 'caution';
  }

  let conflicts = allConflicts;
  if (highlightRow) {
    const filtered = filterForHighlight(allConflicts, contraindicationAlerts, highlightRow);
    conflicts = filtered.conflicts.length ? filtered.conflicts : allConflicts;
    contraindicationAlerts = filtered.contraindication_alerts;
    if (filtered.conflicts.length) {
      resolvedOverall = filtered.conflicts.some(
        (c) => c.verdict === 'avoid' || c.severity === 'critical',
      )
        ? 'avoid'
        : 'caution';
    }
  }

  const compatibility_score = overallToScore(resolvedOverall, barrier.barrier_friction_index);
  const routine_step_states = buildRoutineStepStates(db, {
    sessionId,
    patientId,
    slots: lineup.slots,
    conflicts,
    bfi: barrier.barrier_friction_index,
  });

  const product_statuses = (lineup.productRows || []).map((row) => ({
    shelf_product_id: row.id,
    product_name: row.custom_product_name || row.catalog_product_id,
    status: perProductStatus({ conflicts }, row),
    usage_time: row.usage_time,
    note:
      String(row.id) === String(state.highlight_product_id) && conflicts[0]?.notes
        ? conflicts[0].notes
        : undefined,
  }));

  return {
    barrier,
    conflicts,
    contraindicationAlerts,
    overall: resolvedOverall,
    compatibility_score,
    routine_step_states,
    product_statuses,
  };
}

function formatEvaluateResponse(state) {
  const db = state.sqlite_db;
  const {
    lineup,
    highlightRow,
    bioContext,
    verdict,
    conflicts,
    contraindicationAlerts,
    overall,
    compatibility_score,
    barrier,
    routine_step_states,
    product_statuses,
    highlight_product_id,
  } = state;

  const lineup_hash = computeLineupHash({ slots: lineup.slots, bioProfile: bioContext });
  const spacing_notes = buildSpacingNotes(conflicts);
  const evidence_snippets = buildEvidenceSnippets(db, { ...verdict, conflicts });
  const suggested_fix = buildSuggestedFix(verdict, contraindicationAlerts);

  const productName =
    highlightRow?.custom_product_name || highlightRow?.catalog_product_id || null;

  let heroTitle =
    overall === 'avoid'
      ? 'High conflict for you'
      : overall === 'caution'
        ? 'Barrier under stress'
        : 'Looking good';
  let heroSub =
    overall === 'safe'
      ? 'Your current lineup is compatible.'
      : `${conflicts.length} issue${conflicts.length === 1 ? '' : 's'} detected in your stack.`;

  if (highlightRow && productName) {
    heroTitle =
      overall === 'avoid'
        ? 'High conflict for you'
        : overall === 'caution'
          ? 'Use with caution'
          : 'Looks compatible';
    heroSub =
      overall === 'safe'
        ? `${productName} fits your current routine.`
        : `${productName} may clash with actives already on your shelf.`;
  }

  return {
    evaluate_result: {
      success: true,
      has_lineup: (lineup.slots || []).length > 0,
      source: lineup.source,
      overall,
      compatibility_score,
      barrier_friction_index: barrier.barrier_friction_index,
      barrier_label: barrier.barrier_label,
      conflicts,
      spacing_notes,
      contraindication_alerts: contraindicationAlerts,
      suggested_split: verdict.suggested_split,
      suggested_fix,
      evidence_snippets,
      lineup_hash,
      slots: lineup.slots,
      product_statuses,
      routine_step_states,
      profile_complete: bioContext.profile_complete,
      partial_verdict: !bioContext.profile_complete,
      hero_title: heroTitle,
      hero_subtitle: heroSub,
      highlight_product_id: highlight_product_id || null,
      reason_codes: verdict.reason_codes || [],
      graph_unavailable: false,
    },
  };
}

function runEvaluatePipelineSync(db, opts) {
  let state = {
    sqlite_db: db,
    session_id: opts.sessionId,
    patient_id: opts.patientId,
    sessionId: opts.sessionId,
    patientId: opts.patientId,
    slots: opts.slots,
    highlight_product_id: opts.highlightProductId || null,
  };

  Object.assign(state, loadConsumerContextSync(state));
  Object.assign(state, resolveLineupSlots(state));

  const conflictOut = ingredientConflictNode(state);
  if (conflictOut.graph_unavailable) {
    return { success: false, error: conflictOut.error, graph_unavailable: true };
  }
  Object.assign(state, conflictOut);

  Object.assign(state, barrierMetricsNode(state));
  return formatEvaluateResponse(state).evaluate_result;
}

async function runEvaluatePipeline(db, opts) {
  let state = {
    sqlite_db: db,
    session_id: opts.sessionId,
    patient_id: opts.patientId,
    sessionId: opts.sessionId,
    patientId: opts.patientId,
    slots: opts.slots,
    highlight_product_id: opts.highlightProductId || null,
  };

  Object.assign(state, await loadConsumerContext(state));
  Object.assign(state, resolveLineupSlots(state));

  const conflictOut = ingredientConflictNode(state);
  if (conflictOut.graph_unavailable) {
    return { success: false, error: conflictOut.error, graph_unavailable: true };
  }
  Object.assign(state, conflictOut);

  Object.assign(state, barrierMetricsNode(state));
  return formatEvaluateResponse(state).evaluate_result;
}

module.exports = {
  loadConsumerContext,
  loadConsumerContextSync,
  resolveLineupSlots,
  ingredientConflictNode,
  barrierMetricsNode,
  formatEvaluateResponse,
  runEvaluatePipeline,
  runEvaluatePipelineSync,
};
