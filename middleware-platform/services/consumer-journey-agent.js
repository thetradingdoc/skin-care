'use strict';

require('../utils/langsmith-config');

const { loadLangGraph, getCheckpointer } = require('./consumer-rails/checkpointer');
const { runConsumerLlmStep, parseJsonFromLlm } = require('./consumer-rails/node-runner');
const { executeTool } = require('./consumer-rails/consumer-tool-executor');
const { listGoals } = require('../repositories/patient-goals-repo');

let compiledGraph = null;

function isNextGenPipelineEnabled() {
  const v = process.env.NEXT_GEN_PIPELINE;
  return v === '1' || v === 'true' || v === 'TRUE';
}

function ruleBasedActions({ goals, evaluate, spots, insight }) {
  const actions = [];
  const bfi = Number(evaluate?.barrier_friction_index);
  const conflicts = (evaluate?.conflicts || []).length;

  if (Number.isFinite(bfi) && bfi < 60) {
    actions.push({
      type: 'barrier_recovery',
      title: 'Ease off actives tonight',
      message: 'Your barrier score is low. Focus on moisturizer and skip harsh actives.',
      route: '/(tabs)/home',
      priority: 1,
    });
  }

  if (conflicts > 0) {
    actions.push({
      type: 'resolve_conflicts',
      title: 'Review product conflicts',
      message: `${conflicts} conflict${conflicts === 1 ? '' : 's'} detected on your shelf.`,
      route: '/(tabs)/scan',
      priority: 2,
    });
  }

  const watchGoal = (goals || []).find((g) => g.goal_type === 'watch_spot' && g.status === 'active');
  if (watchGoal && (spots || []).length === 0) {
    actions.push({
      type: 'track_spot',
      title: 'Start tracking a spot',
      message: 'Take a baseline photo to watch a mole or mark over time.',
      route: '/(tabs)/track',
      priority: 3,
    });
  }

  if (insight?.title) {
    actions.push({
      type: 'barrier_insight',
      title: insight.title,
      message: insight.message,
      route: '/(tabs)/progress',
      priority: 4,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 4);
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
    goals: Annotation(),
    evaluate: Annotation(),
    spots: Annotation(),
    insight: Annotation(),
    llm_raw: Annotation(),
    tools_used: Annotation(),
    actions: Annotation(),
    loadShelfRows: Annotation(),
  });

  async function analyzeGoals(state) {
    const goals = await listGoals(state.sqlite_db, {
      sessionId: state.session_id,
      patientId: state.patient_id,
      status: 'active',
    });
    const ctx = {
      db: state.sqlite_db,
      sessionId: state.session_id,
      patientId: state.patient_id,
      loadShelfRows: state.loadShelfRows,
    };
    const evalRes = await executeTool('evaluate_lineup', {}, ctx);
    const spotsRes = await executeTool('get_active_spots', {}, ctx);
    const insightRes = await executeTool('get_barrier_insight', {}, ctx);
    return {
      goals,
      evaluate: evalRes?.evaluate || {},
      spots: spotsRes?.spots || [],
      insight: insightRes?.insight || null,
    };
  }

  async function anticipateNeedsLlm(state) {
    const systemContent = [
      'You are a proactive skincare journey agent.',
      'Given goals and context, suggest 1-3 next actions as JSON array:',
      '[{"type":"...","title":"...","message":"...","route":"/(tabs)/home|track|scan|progress","priority":1}]',
      'Routes must be app paths. Not medical advice.',
    ].join(' ');

    const userContent = [
      `Active goals: ${(state.goals || []).map((g) => g.goal_type).join(', ') || 'none'}`,
      `BFI: ${state.evaluate?.barrier_friction_index ?? 'unknown'}`,
      `Conflicts: ${(state.evaluate?.conflicts || []).length}`,
      `Spots tracked: ${(state.spots || []).length}`,
      state.insight?.message ? `Barrier insight: ${state.insight.message}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const ctx = {
      db: state.sqlite_db,
      sessionId: state.session_id,
      patientId: state.patient_id,
      loadShelfRows: state.loadShelfRows,
    };

    const llm = await runConsumerLlmStep({
      graphKind: 'journey',
      systemContent,
      userContent,
      ctx,
    });
    return { llm_raw: llm.content || '', tools_used: llm.tools_used || [] };
  }

  function formatNextActions(state) {
    const parsed = parseJsonFromLlm(state.llm_raw);
    if (Array.isArray(parsed) && parsed.length) {
      return { actions: parsed.slice(0, 4) };
    }
    return {
      actions: ruleBasedActions({
        goals: state.goals,
        evaluate: state.evaluate,
        spots: state.spots,
        insight: state.insight,
      }),
    };
  }

  const graph = new StateGraph(State)
    .addNode('analyze_goals', analyzeGoals)
    .addNode('anticipate_needs_llm', anticipateNeedsLlm)
    .addNode('format_next_actions', formatNextActions)
    .addEdge(START, 'analyze_goals')
    .addEdge('analyze_goals', 'anticipate_needs_llm')
    .addEdge('anticipate_needs_llm', 'format_next_actions')
    .addEdge('format_next_actions', END);

  compiledGraph = graph.compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

async function getNextActions(sqliteDb, opts) {
  const { sessionId, patientId, loadShelfRows } = opts;

  const goals = await listGoals(sqliteDb, { sessionId, patientId, status: 'active' });
  const ctx = {
    db: sqliteDb,
    sessionId,
    patientId,
    loadShelfRows,
  };
  const evalRes = await executeTool('evaluate_lineup', {}, ctx);
  const spotsRes = await executeTool('get_active_spots', {}, ctx);
  const insightRes = await executeTool('get_barrier_insight', {}, ctx);

  const fallback = {
    actions: ruleBasedActions({
      goals,
      evaluate: evalRes?.evaluate,
      spots: spotsRes?.spots,
      insight: insightRes?.insight,
    }),
  };

  if (!isNextGenPipelineEnabled()) return fallback;

  try {
    const graph = await getGraph();
    if (!graph) return fallback;

    const out = await graph.invoke(
      {
        sqlite_db: sqliteDb,
        session_id: sessionId,
        patient_id: patientId,
        loadShelfRows,
      },
      {
        configurable: { thread_id: sessionId || `journey-${patientId || 'anon'}` },
        runName: 'consumer_journey_agent',
        tags: ['consumer-graph', 'phase-4'],
        metadata: { session_id: sessionId, patient_id: patientId || null },
      },
    );

    return { actions: out?.actions || fallback.actions, tools_used: out?.tools_used || [] };
  } catch (e) {
    console.warn('[consumer-journey-agent] fallback:', e.message);
    return fallback;
  }
}

module.exports = {
  isNextGenPipelineEnabled,
  getNextActions,
  ruleBasedActions,
};
