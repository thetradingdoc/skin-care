'use strict';

require('../utils/langsmith-config');

const { redisGet, redisSet } = require('../lib/redis-client');
const { loadLangGraph, getCheckpointer } = require('./consumer-rails/checkpointer');
const {
  loadConsumerContext,
  resolveLineupSlots,
  ingredientConflictNode,
  barrierMetricsNode,
  formatEvaluateResponse,
  runEvaluatePipeline,
} = require('./consumer-evaluate-nodes');

let compiledGraph = null;

let ROLLOUT_PCT = parseFloat(process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT || '0');
if (process.env.NODE_ENV === 'production') {
  const pct = Number.isFinite(ROLLOUT_PCT) ? ROLLOUT_PCT : 0;
  if (pct > 0 && pct < 1) {
    throw new Error(
      `LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT must be 0 or 1 in production (got ${process.env.LANGGRAPH_CONSUMER_EVAL_ROLLOUT_PCT})`,
    );
  }
  ROLLOUT_PCT = pct;
}

function shouldUseGraph(sessionId) {
  if (ROLLOUT_PCT >= 1) return true;
  if (ROLLOUT_PCT <= 0) return false;
  const hash = String(sessionId || '')
    .split('')
    .reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 100 < ROLLOUT_PCT * 100;
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
    sessionId: Annotation(),
    patientId: Annotation(),
    slots: Annotation(),
    highlight_product_id: Annotation(),
    bioContext: Annotation(),
    consumerProfile: Annotation(),
    lineup: Annotation(),
    highlightRow: Annotation(),
    verdict: Annotation(),
    allConflicts: Annotation(),
    overall: Annotation(),
    barrier: Annotation(),
    conflicts: Annotation(),
    contraindicationAlerts: Annotation(),
    compatibility_score: Annotation(),
    routine_step_states: Annotation(),
    product_statuses: Annotation(),
    evaluate_result: Annotation(),
    graph_unavailable: Annotation(),
    error: Annotation(),
  });

  async function nodeLoadContext(state) {
    const patch = await loadConsumerContext(state);
    return { ...patch, sessionId: state.session_id, patientId: state.patient_id };
  }

  function nodeResolveSlots(state) {
    return resolveLineupSlots(state);
  }

  function nodeConflict(state) {
    return ingredientConflictNode(state);
  }

  function nodeBarrier(state) {
    return barrierMetricsNode(state);
  }

  function nodeFormat(state) {
    return formatEvaluateResponse(state);
  }

  const graph = new StateGraph(State)
    .addNode('load_consumer_context', nodeLoadContext)
    .addNode('resolve_lineup_slots', nodeResolveSlots)
    .addNode('ingredient_conflict_node', nodeConflict)
    .addNode('barrier_metrics_node', nodeBarrier)
    .addNode('format_evaluate_response', nodeFormat)
    .addEdge(START, 'load_consumer_context')
    .addEdge('load_consumer_context', 'resolve_lineup_slots')
    .addEdge('resolve_lineup_slots', 'ingredient_conflict_node')
    .addEdge('ingredient_conflict_node', 'barrier_metrics_node')
    .addEdge('barrier_metrics_node', 'format_evaluate_response')
    .addEdge('format_evaluate_response', END);

  compiledGraph = graph.compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

function evaluateCacheKey({ patientId, sessionId, lineupHash }) {
  const owner = patientId || sessionId || 'anon';
  return `consumer:eval:${owner}:${lineupHash || 'default'}`;
}

async function evaluateWithGraph(sqliteDb, opts) {
  const { sessionId, patientId, slots, highlightProductId } = opts;

  const { runEvaluatePipelineSync } = require('./consumer-evaluate-nodes');
  let legacy;
  try {
    legacy = runEvaluatePipelineSync(sqliteDb, {
      sessionId,
      patientId,
      slots,
      highlightProductId,
    });
  } catch (e) {
    return { success: false, error: e.message, graph_unavailable: true };
  }

  if (!legacy?.success) return legacy;

  const cacheKey = evaluateCacheKey({
    patientId,
    sessionId,
    lineupHash: legacy.lineup_hash,
  });
  const cached = await redisGet(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed?.success) return parsed;
    } catch (_) {}
  } else if (process.env.REDIS_URL) {
    console.log('[consumer-analysis-graph] cache_miss', { session_id: sessionId, lineup_hash: legacy.lineup_hash });
  }

  if (!shouldUseGraph(sessionId)) {
    if (legacy?.success && legacy.lineup_hash) {
      await redisSet(cacheKey, JSON.stringify(legacy), 900);
    }
    return legacy;
  }

  try {
    const graph = await getGraph();
    if (!graph) {
      if (legacy?.success && legacy.lineup_hash) {
        await redisSet(cacheKey, JSON.stringify(legacy), 900);
      }
      return legacy;
    }

    const threadId = sessionId || `eval-${patientId || 'anon'}`;
    const out = await graph.invoke(
      {
        sqlite_db: sqliteDb,
        session_id: sessionId,
        patient_id: patientId,
        sessionId,
        patientId,
        slots,
        highlight_product_id: highlightProductId || null,
      },
      {
        configurable: { thread_id: threadId },
        runName: 'consumer_evaluate_lineup',
        tags: ['consumer-graph', 'phase-2'],
        metadata: { session_id: sessionId, patient_id: patientId || null },
      },
    );

    const result = out?.evaluate_result || legacy;
    if (result?.graph_unavailable || result?.error === 'conflict_graph_unavailable') {
      return legacy?.success ? legacy : result;
    }
    if (result?.success && result.lineup_hash) {
      await redisSet(cacheKey, JSON.stringify(result), 900);
    }
    return result;
  } catch (e) {
    console.warn('[consumer-analysis-graph] invoke failed, fallback:', e.message);
    return legacy?.success ? legacy : { success: false, error: e.message, graph_unavailable: true };
  }
}

module.exports = {
  evaluateWithGraph,
  shouldUseGraph,
  runEvaluatePipeline,
};
