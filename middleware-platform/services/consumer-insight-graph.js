'use strict';

require('../utils/langsmith-config');

const { redisGet, redisSet } = require('../lib/redis-client');
const { loadLangGraph, getCheckpointer } = require('./consumer-rails/checkpointer');
const { runConsumerLlmStep, parseJsonFromLlm } = require('./consumer-rails/node-runner');
const { executeTool } = require('./consumer-rails/consumer-tool-executor');
const {
  isV3InsightsLlmEnabled,
  computeProductInsight,
} = require('./consumer-insight-service');
const { parseInsightPayload } = require('./consumer-insight-schema');

let compiledGraph = null;

function isInsightGraphEnabled() {
  return isV3InsightsLlmEnabled();
}

function insightCacheKey({ patientId, sessionId, productId, lineupHash }) {
  const owner = patientId || sessionId || 'anon';
  return `consumer:insight:${owner}:${productId}:${lineupHash || 'x'}`;
}

async function getGraph() {
  if (compiledGraph) return compiledGraph;
  const LG = await loadLangGraph();
  if (!LG) return null;

  const { StateGraph, Annotation, START, END } = LG;
  const checkpointer = await getCheckpointer();

  const State = Annotation.Root({
    sqlite_db: Annotation(),
    session_id: Annotation(),
    patient_id: Annotation(),
    product_id: Annotation(),
    product: Annotation(),
    evaluate: Annotation(),
    phase_label: Annotation(),
    system_prompt: Annotation(),
    user_prompt: Annotation(),
    llm_raw: Annotation(),
    tools_used: Annotation(),
    insight: Annotation(),
    loadShelfRows: Annotation(),
  });

  async function attachGuidance(state) {
    const ctx = {
      db: state.sqlite_db,
      sessionId: state.session_id,
      patientId: state.patient_id,
      productId: state.product_id,
      loadShelfRows: state.loadShelfRows,
    };
    const productRes = await executeTool('get_product_details', { product_id: state.product_id }, ctx);
    const evalRes = await executeTool('evaluate_lineup', {}, ctx);
    const phaseRes = await executeTool('get_routine_phase', {}, ctx);

    const product = productRes?.product || {};
    const evaluate = evalRes?.evaluate || {};
    const phaseLabel = phaseRes?.phase_label || null;

    const system_prompt = [
      'You are a skincare product insight composer for a consumer app.',
      'Use tools when you need barrier, bio, or evidence context.',
      'Respond with JSON only: {"title":"...","message":"...","severity":"info|watch|caution","barrier_note":"...","skin_note":"..."}',
      'Not medical advice. Be specific to the patient profile.',
    ].join(' ');

    const user_prompt = [
      `Product: ${product.product_name || 'Unknown'}`,
      `BFI: ${evaluate.barrier_friction_index ?? 'unknown'}`,
      `Overall: ${evaluate.overall ?? 'unknown'}`,
      `Conflicts: ${(evaluate.conflicts || []).length}`,
      phaseLabel ? `Program phase: ${phaseLabel}` : '',
      'Write a short personalized insight for this product on the Verdict screen.',
    ]
      .filter(Boolean)
      .join('\n');

    return { product, evaluate, phase_label: phaseLabel, system_prompt, user_prompt };
  }

  async function composeInsightLlm(state) {
    const ctx = {
      db: state.sqlite_db,
      sessionId: state.session_id,
      patientId: state.patient_id,
      productId: state.product_id,
      loadShelfRows: state.loadShelfRows,
    };
    const llm = await runConsumerLlmStep({
      graphKind: 'insight',
      systemContent: state.system_prompt,
      userContent: state.user_prompt,
      ctx,
    });
    return { llm_raw: llm.content || '', tools_used: llm.tools_used || [], llm_error: llm.error || null };
  }

  function formatInsight(state) {
    const raw = parseJsonFromLlm(state.llm_raw);
    const validated = parseInsightPayload(raw);
    if (validated) {
      return {
        insight: {
          ...validated,
          lineup_hash: state.evaluate?.lineup_hash || null,
        },
      };
    }
    const fallback = computeProductInsight({
      product: state.product,
      bioProfile: { conditions: [], prescriptions: [] },
      barrierFrictionIndex: state.evaluate?.barrier_friction_index,
      phaseLabel: state.phase_label,
      lineupHash: state.evaluate?.lineup_hash,
    });
    return { insight: fallback };
  }

  const graph = new StateGraph(State)
    .addNode('attach_guidance', attachGuidance)
    .addNode('compose_insight_llm', composeInsightLlm)
    .addNode('format_insight', formatInsight)
    .addEdge(START, 'attach_guidance')
    .addEdge('attach_guidance', 'compose_insight_llm')
    .addEdge('compose_insight_llm', 'format_insight')
    .addEdge('format_insight', END);

  compiledGraph = graph.compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

async function composeProductInsightWithGraph(sqliteDb, opts) {
  const { sessionId, patientId, productId, product, evaluate, loadShelfRows } = opts;

  if (!isInsightGraphEnabled()) {
    return computeProductInsight({
      product,
      bioProfile: opts.bioProfile,
      barrierFrictionIndex: evaluate?.barrier_friction_index,
      phaseLabel: opts.phaseLabel,
      lineupHash: evaluate?.lineup_hash,
    });
  }

  const cacheKey = insightCacheKey({
    patientId,
    sessionId,
    productId,
    lineupHash: evaluate?.lineup_hash,
  });
  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (_) {}
  }

  try {
    const graph = await getGraph();
    if (!graph) {
      return computeProductInsight({
        product,
        bioProfile: opts.bioProfile,
        barrierFrictionIndex: evaluate?.barrier_friction_index,
        phaseLabel: opts.phaseLabel,
        lineupHash: evaluate?.lineup_hash,
      });
    }

    const out = await graph.invoke(
      {
        sqlite_db: sqliteDb,
        session_id: sessionId,
        patient_id: patientId,
        product_id: productId,
        product,
        evaluate,
        loadShelfRows,
      },
      {
        configurable: { thread_id: sessionId || `insight-${productId}` },
        runName: 'consumer_compose_insight',
        tags: ['consumer-graph', 'phase-3'],
        metadata: { session_id: sessionId, product_id: productId },
      },
    );

    const insight = out?.insight;
    if (insight) await redisSet(cacheKey, JSON.stringify(insight), 3600);
    return insight;
  } catch (e) {
    console.warn('[consumer-insight-graph] fallback:', e.message);
    return computeProductInsight({
      product,
      bioProfile: opts.bioProfile,
      barrierFrictionIndex: evaluate?.barrier_friction_index,
      phaseLabel: opts.phaseLabel,
      lineupHash: evaluate?.lineup_hash,
    });
  }
}

module.exports = {
  isInsightGraphEnabled,
  composeProductInsightWithGraph,
};
