'use strict';

/**
 * P4.04 — capture_compose graph: quality → meter_guard → extract/structure → format confirm.
 *
 * DEMOTION (2026-07-16 product decision): `orchestrateCapture` is the canonical
 * HTTP/production capture path. This graph is a policy/tool reference and a
 * future multi-turn option — not a live entrypoint. Do not wire
 * `runCaptureCompose` into routes/patient-records.js or any product traffic.
 * Persist + AV + multi-tag + policy-on-persist live in capture-orchestration.
 */

const { executeMedicalTool } = require('./medical-tool-executor');
const { meterGuardNode, meterGuardRefund } = require('./meter-guard-node');
const { contentHash, getCachedCompose, setCachedCompose } = require('./capture-compose-cache');
const { loadLangGraph, getMedicalCheckpointer } = require('./checkpointer');
const {
  assertNoDiagnosisVocabulary,
  assertAiSuggestionShape,
  stripCommerceFromPrescription,
  assertNoCommerceOnPrescription,
} = require('./policy');
const { captureKindForTag } = require('../capture-orchestration');

let compiledGraph = null;

async function runCaptureComposeSync(opts = {}) {
  const {
    db,
    tag,
    aiOrManual = 'manual',
    buffer = null,
    mimeType = null,
    fileName = null,
    patientId = null,
    sessionId = null,
    isPlus = false,
    userHints = {},
    skipCache = false,
  } = opts;

  const hash = contentHash({ tag, buffer, mimeType, aiOrManual, userHints });
  const cacheScopeOpts = { patientId, sessionId };
  if (!skipCache) {
    const cached = await getCachedCompose(hash, cacheScopeOpts);
    if (cached) return { ...cached, cache_hit: true };
  }

  const ctx = {
    db,
    graphKind: 'capture_compose',
    tag,
    buffer,
    mimeType,
    fileName,
    patientId,
    sessionId,
    userHints,
  };

  // 1) Quality (unmetered)
  const qualityRes = await executeMedicalTool(
    'assess_quality',
    { tag, mime_type: mimeType, meta: opts.qualityMeta || null },
    ctx,
  );
  if (!qualityRes.success || !qualityRes.quality?.ok) {
    return {
      ok: false,
      error_code: 'QUALITY_GATE_FAILED',
      quality: qualityRes.quality || null,
      action: qualityRes.quality?.action || 'retake',
    };
  }

  let usageId = null;
  const needsAi = String(aiOrManual).toLowerCase() === 'ai';

  // 2) Meter guard for AI paths only (P4.06)
  if (needsAi) {
    const meter = meterGuardNode(db, {
      patientId,
      sessionId,
      captureKind: captureKindForTag(tag) || 'capture_compose',
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

  let rawExtractText = null;
  let structured = null;

  try {
    // 3) Extract when AI + doc-like tags
    if (needsAi && ['bill', 'lab', 'prescription', 'other'].includes(tag)) {
      const extract = await executeMedicalTool(
        'get_extract',
        { mime_type: mimeType, file_name: fileName },
        ctx,
      );
      if (!extract.success) {
        if (usageId) meterGuardRefund(db, usageId, 'extract_failed');
        return { ok: false, error_code: extract.error_code || 'EXTRACT_FAILED', error: extract.error };
      }
      rawExtractText = extract.text || '';
      ctx.rawExtractText = rawExtractText;
    }

    // 4) Structure
    const struct = await executeMedicalTool(
      'structure_by_tag',
      {
        tag,
        ocr_text: rawExtractText || '',
        user_hints: userHints,
        mime_type: mimeType,
        file_name: fileName,
      },
      { ...ctx, rawExtractText },
    );
    if (!struct.success) {
      if (usageId) meterGuardRefund(db, usageId, 'structure_failed');
      return {
        ok: false,
        error_code: struct.error_code || 'STRUCTURE_INVALID',
        errors: struct.errors || struct.matches,
      };
    }
    structured = stripCommerceFromPrescription(tag, struct.structured_json);

    if (tag === 'prescription') {
      const commerce = assertNoCommerceOnPrescription(structured);
      if (!commerce.ok) {
        if (usageId) meterGuardRefund(db, usageId, 'prescription_commerce');
        return { ok: false, error_code: commerce.error_code, keys: commerce.keys };
      }
    }

    const shape = assertAiSuggestionShape(structured);
    if (!shape.ok) {
      if (usageId) meterGuardRefund(db, usageId, 'ai_shape');
      return { ok: false, error_code: shape.error_code, message: shape.message };
    }

    const vocab = assertNoDiagnosisVocabulary(JSON.stringify(structured));
    if (!vocab.ok) {
      if (usageId) meterGuardRefund(db, usageId, 'diagnosis_vocab');
      return { ok: false, error_code: 'DIAGNOSIS_VOCABULARY', matches: vocab.matches };
    }

    // 5) Format confirm draft
    const formatted = await executeMedicalTool(
      'format_confirm_draft',
      { tag, structured_json: structured, raw_extract_text: rawExtractText },
      ctx,
    );
    if (!formatted.success) {
      if (usageId) meterGuardRefund(db, usageId, 'format_failed');
      return { ok: false, error_code: formatted.error_code || 'FORMAT_FAILED' };
    }

    const result = {
      ok: true,
      tag,
      ai_or_manual: needsAi ? 'ai' : 'manual',
      usage_id: usageId,
      quality: qualityRes.quality,
      draft: formatted.draft,
      content_hash: hash,
      cache_hit: false,
    };
    await setCachedCompose(hash, result, cacheScopeOpts);
    return result;
  } catch (e) {
    if (usageId) meterGuardRefund(db, usageId, e.message || 'capture_compose_error');
    return { ok: false, error_code: 'CAPTURE_COMPOSE_FAILED', error: e.message };
  }
}

async function getCaptureComposeGraph() {
  if (compiledGraph) return compiledGraph;
  const LG = await loadLangGraph();
  if (!LG) return null;
  const { StateGraph, Annotation, START, END } = LG;
  const checkpointer = await getMedicalCheckpointer();

  const State = Annotation.Root({
    db: Annotation(),
    tag: Annotation(),
    aiOrManual: Annotation(),
    buffer: Annotation(),
    mimeType: Annotation(),
    fileName: Annotation(),
    patientId: Annotation(),
    sessionId: Annotation(),
    isPlus: Annotation(),
    userHints: Annotation(),
    result: Annotation(),
  });

  async function nodeRun(state) {
    const result = await runCaptureComposeSync(state);
    return { result };
  }

  const graph = new StateGraph(State)
    .addNode('capture_compose_run', nodeRun)
    .addEdge(START, 'capture_compose_run')
    .addEdge('capture_compose_run', END);

  compiledGraph = graph.compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

async function runCaptureCompose(opts = {}) {
  const graph = await getCaptureComposeGraph();
  if (!graph) return runCaptureComposeSync(opts);
  try {
    const threadId = `medical-capture:${opts.sessionId || 'anon'}:${opts.tag || 'x'}`;
    const out = await graph.invoke(
      {
        db: opts.db,
        tag: opts.tag,
        aiOrManual: opts.aiOrManual || 'manual',
        buffer: opts.buffer || null,
        mimeType: opts.mimeType || null,
        fileName: opts.fileName || null,
        patientId: opts.patientId || null,
        sessionId: opts.sessionId || null,
        isPlus: Boolean(opts.isPlus),
        userHints: opts.userHints || {},
      },
      { configurable: { thread_id: threadId } },
    );
    return out.result || runCaptureComposeSync(opts);
  } catch (e) {
    console.warn('[capture_compose] graph failed, sync fallback:', e.message);
    return runCaptureComposeSync(opts);
  }
}

module.exports = {
  runCaptureCompose,
  runCaptureComposeSync,
  getCaptureComposeGraph,
};
