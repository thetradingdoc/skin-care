'use strict';

let graphModule = null;
let checkpointer = null;

async function loadLangGraph() {
  if (graphModule) return graphModule;
  try {
    graphModule = await import('@langchain/langgraph');
    return graphModule;
  } catch (e) {
    console.warn('[consumer-rails] LangGraph not available:', e.message);
    return null;
  }
}

async function getCheckpointer() {
  if (checkpointer) return checkpointer;
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const usePostgres =
    connStr && (process.env.NODE_ENV === 'production' || process.env.LANGGRAPH_USE_POSTGRES === 'true');
  if (usePostgres) {
    try {
      const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
      const cp = PostgresSaver.fromConnString(connStr, {
        schema: process.env.LANGGRAPH_CHECKPOINT_SCHEMA || 'public',
      });
      await cp.setup();
      console.log('[consumer-rails] checkpointer: PostgresSaver');
      checkpointer = cp;
      return checkpointer;
    } catch (e) {
      console.warn('[consumer-rails] PostgresSaver failed, using MemorySaver:', e.message);
    }
  }
  const LG = await loadLangGraph();
  checkpointer = LG ? new LG.MemorySaver() : null;
  return checkpointer;
}

module.exports = { loadLangGraph, getCheckpointer };
