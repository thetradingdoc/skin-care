'use strict';

/**
 * P4.08 — Postgres checkpointer for medical-tracker graphs (staging/prod).
 * Same selection rules as consumer-rails; separate module so medical never
 * shares compiled graph state with shelf insight.
 */

let graphModule = null;
let checkpointer = null;

async function loadLangGraph() {
  if (graphModule) return graphModule;
  try {
    graphModule = await import('@langchain/langgraph');
    return graphModule;
  } catch (e) {
    console.warn('[medical-tracker-rails] LangGraph not available:', e.message);
    return null;
  }
}

async function getMedicalCheckpointer() {
  if (checkpointer) return checkpointer;
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const usePostgres =
    connStr &&
    (process.env.NODE_ENV === 'production' ||
      process.env.LANGGRAPH_USE_POSTGRES === 'true' ||
      process.env.LANGGRAPH_MEDICAL_USE_POSTGRES === 'true');
  if (usePostgres) {
    try {
      const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
      const cp = PostgresSaver.fromConnString(connStr, {
        schema: process.env.LANGGRAPH_CHECKPOINT_SCHEMA || 'public',
      });
      await cp.setup();
      console.log('[medical-tracker-rails] checkpointer: PostgresSaver');
      checkpointer = cp;
      return checkpointer;
    } catch (e) {
      console.warn('[medical-tracker-rails] PostgresSaver failed, using MemorySaver:', e.message);
    }
  }
  const LG = await loadLangGraph();
  checkpointer = LG ? new LG.MemorySaver() : null;
  return checkpointer;
}

/** Test-only reset */
function resetMedicalCheckpointerForTests() {
  checkpointer = null;
}

module.exports = {
  loadLangGraph,
  getMedicalCheckpointer,
  resetMedicalCheckpointerForTests,
};
