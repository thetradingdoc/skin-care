'use strict';

/**
 * P4.07 — export_pack graph: retrieval-only facts + media for physician export.
 * No AI narrative, no interpretation layer.
 */

const { executeMedicalTool } = require('./medical-tool-executor');
const { loadLangGraph, getMedicalCheckpointer } = require('./checkpointer');

let compiledGraph = null;

async function runExportPackSync(opts = {}) {
  const {
    db,
    patientId = null,
    sessionId = null,
    tag = null,
    start = null,
    end = null,
    limit = 100,
  } = opts;

  const res = await executeMedicalTool(
    'list_facts_for_export',
    { tag, start, end, limit },
    { db, graphKind: 'export_pack', patientId, sessionId },
  );
  if (!res.success) {
    return { ok: false, error_code: res.error_code || 'EXPORT_FAILED', error: res.error };
  }

  // Hard guarantees: no AI narrative fields
  return {
    ok: true,
    facts: res.facts || [],
    media: (res.facts || [])
      .filter((f) => f.media_url || f.storage_ref)
      .map((f) => ({
        fact_id: f.id,
        tag: f.tag,
        media_url: f.media_url || null,
        media_url_expires_at: f.media_url_expires_at || null,
        media_type: f.media_type || null,
      })),
    narrative: null,
    interpretation: null,
    ai_generated: false,
    summary: null,
  };
}

async function getExportPackGraph() {
  if (compiledGraph) return compiledGraph;
  const LG = await loadLangGraph();
  if (!LG) return null;
  const { StateGraph, Annotation, START, END } = LG;
  const checkpointer = await getMedicalCheckpointer();
  const State = Annotation.Root({
    db: Annotation(),
    patientId: Annotation(),
    sessionId: Annotation(),
    tag: Annotation(),
    start: Annotation(),
    end: Annotation(),
    limit: Annotation(),
    result: Annotation(),
  });
  async function nodeRun(state) {
    return { result: await runExportPackSync(state) };
  }
  compiledGraph = new StateGraph(State)
    .addNode('export_pack_run', nodeRun)
    .addEdge(START, 'export_pack_run')
    .addEdge('export_pack_run', END)
    .compile({ checkpointer: checkpointer || undefined });
  return compiledGraph;
}

async function runExportPack(opts = {}) {
  const graph = await getExportPackGraph();
  if (!graph) return runExportPackSync(opts);
  try {
    const out = await graph.invoke(
      {
        db: opts.db,
        patientId: opts.patientId || null,
        sessionId: opts.sessionId || null,
        tag: opts.tag || null,
        start: opts.start || null,
        end: opts.end || null,
        limit: opts.limit || 100,
      },
      { configurable: { thread_id: `medical-export:${opts.sessionId || opts.patientId || 'anon'}` } },
    );
    return out.result || runExportPackSync(opts);
  } catch (e) {
    console.warn('[export_pack] graph failed, sync fallback:', e.message);
    return runExportPackSync(opts);
  }
}

module.exports = {
  runExportPack,
  runExportPackSync,
  getExportPackGraph,
};
