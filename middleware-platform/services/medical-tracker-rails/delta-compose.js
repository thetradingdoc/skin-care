'use strict';

/**
 * P4.05 — delta_compose: prior skin + today → AI SUGGESTS worse|same|calmer
 * Landing field is always ai_suggestion — never blended into user-confirmed values.
 */

const { executeMedicalTool } = require('./medical-tool-executor');
const { meterGuardNode, meterGuardRefund } = require('./meter-guard-node');
const { loadLangGraph, getMedicalCheckpointer } = require('./checkpointer');
const {
  assertNoDiagnosisVocabulary,
  assertAiSuggestionShape,
} = require('./policy');

let compiledGraph = null;

async function runDeltaComposeSync(opts = {}) {
  const {
    db,
    patientId = null,
    sessionId = null,
    isPlus = false,
    todayStructured = null,
    priorStructured = null,
    aiOrManual = 'ai',
  } = opts;

  const ctx = { db, graphKind: 'delta_compose', patientId, sessionId, tag: 'skin' };

  let prior = priorStructured;
  if (prior == null) {
    const priors = await executeMedicalTool('get_prior_skin_facts', { limit: 1 }, ctx);
    if (!priors.success) {
      return { ok: false, error_code: priors.error_code || 'PRIOR_LOOKUP_FAILED' };
    }
    // First-ever skin log: empty prior → suggest_skin_delta returns delta: 'baseline'
    // (matches onboarding 5b-skin baseline — never invent worse/same/calmer against nothing).
    prior = priors.facts?.[0]?.structured_json || {};
  }

  const todayNorm = await executeMedicalTool(
    'normalize_facts',
    { tag: 'skin', structured_json: todayStructured || {} },
    ctx,
  );
  if (!todayNorm.success) {
    return { ok: false, error_code: 'TODAY_INVALID', errors: todayNorm.errors };
  }

  const userFields = { ...todayNorm.structured_json };
  const confirmedOnly = { ...userFields, ai_suggestion: null };

  let usageId = null;
  if (String(aiOrManual).toLowerCase() === 'ai') {
    const meter = meterGuardNode(db, {
      patientId,
      sessionId,
      captureKind: 'skin_delta_compose',
      isPlus,
      aiOrManual: 'ai',
    });
    if (!meter.ok) {
      return {
        ok: false,
        status: meter.status,
        error_code: meter.body?.error_code || 'AI_CAPTURE_LIMIT',
        body: meter.body,
        manual_allowed: true,
      };
    }
    usageId = meter.usageId;
  }

  try {
    const sug = await executeMedicalTool(
      'suggest_skin_delta',
      { prior_structured: prior, today_structured: confirmedOnly },
      ctx,
    );
    if (!sug.success) {
      if (usageId) meterGuardRefund(db, usageId, 'delta_suggest_failed');
      return { ok: false, error_code: sug.error_code || 'DELTA_FAILED', matches: sug.matches };
    }

    const merged = {
      ...confirmedOnly,
      ai_suggestion: sug.ai_suggestion,
    };

    const shape = assertAiSuggestionShape(merged);
    if (!shape.ok) {
      if (usageId) meterGuardRefund(db, usageId, 'ai_shape');
      return { ok: false, error_code: shape.error_code, message: shape.message };
    }
    const vocab = assertNoDiagnosisVocabulary(JSON.stringify(merged.ai_suggestion));
    if (!vocab.ok) {
      if (usageId) meterGuardRefund(db, usageId, 'diagnosis_vocab');
      return { ok: false, error_code: 'DIAGNOSIS_VOCABULARY', matches: vocab.matches };
    }

    for (const key of ['note', 'body_area', 'date']) {
      if (confirmedOnly[key] !== merged[key]) {
        if (usageId) meterGuardRefund(db, usageId, 'user_field_mutated');
        return { ok: false, error_code: 'USER_FIELD_MUTATED', field: key };
      }
    }

    return {
      ok: true,
      usage_id: usageId,
      structured_json: merged,
      ai_suggestion: sug.ai_suggestion,
      prior_used: Boolean(sug.ai_suggestion?.prior_used),
      baseline: sug.ai_suggestion?.delta === 'baseline',
    };
  } catch (e) {
    if (usageId) meterGuardRefund(db, usageId, e.message || 'delta_compose_error');
    return { ok: false, error_code: 'DELTA_COMPOSE_FAILED', error: e.message };
  }
}

async function getDeltaComposeGraph() {
  if (compiledGraph) return compiledGraph;
  const LG = await loadLangGraph();
  if (!LG) return null;
  const { StateGraph, Annotation, START, END } = LG;
  const checkpointer = await getMedicalCheckpointer();
  const State = Annotation.Root({
    db: Annotation(),
    patientId: Annotation(),
    sessionId: Annotation(),
    isPlus: Annotation(),
    todayStructured: Annotation(),
    priorStructured: Annotation(),
    aiOrManual: Annotation(),
    result: Annotation(),
  });
  async function nodeRun(state) {
    return { result: await runDeltaComposeSync(state) };
  }
  compiledGraph = new StateGraph(State)
    .addNode('delta_compose_run', nodeRun)
    .addEdge(START, 'delta_compose_run')
    .addEdge('delta_compose_run', END)
    .compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

async function runDeltaCompose(opts = {}) {
  const graph = await getDeltaComposeGraph();
  if (!graph) return runDeltaComposeSync(opts);
  try {
    const out = await graph.invoke(
      {
        db: opts.db,
        patientId: opts.patientId || null,
        sessionId: opts.sessionId || null,
        isPlus: Boolean(opts.isPlus),
        todayStructured: opts.todayStructured || null,
        priorStructured: opts.priorStructured || null,
        aiOrManual: opts.aiOrManual || 'ai',
      },
      { configurable: { thread_id: `medical-delta:${opts.sessionId || 'anon'}` } },
    );
    return out.result || runDeltaComposeSync(opts);
  } catch (e) {
    console.warn('[delta_compose] graph failed, sync fallback:', e.message);
    return runDeltaComposeSync(opts);
  }
}

module.exports = {
  runDeltaCompose,
  runDeltaComposeSync,
  getDeltaComposeGraph,
};
