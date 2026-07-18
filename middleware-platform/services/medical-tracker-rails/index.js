'use strict';

/**
 * Medical-tracker agentic rails (Phase 4).
 * Disjoint from consumer-rails (shelf) and Kelly/perception/coding.
 */

const { getMedicalTools, getMedicalToolNames, MEDICAL_TOOLS } = require('./medical-tool-definitions');
const {
  CAPTURE_COMPOSE_TOOLS,
  DELTA_COMPOSE_TOOLS,
  EXPORT_PACK_TOOLS,
  ALL_MEDICAL_TOOLS,
  getAllowedToolNames,
  isToolAllowed,
} = require('./medical-tool-allowlists');
const { executeMedicalTool } = require('./medical-tool-executor');
const { meterGuardNode, meterGuardRefund, meterGuardRecordTokens } = require('./meter-guard-node');
const { runCaptureCompose, runCaptureComposeSync } = require('./capture-compose');
const { runDeltaCompose, runDeltaComposeSync } = require('./delta-compose');
const { runExportPack, runExportPackSync } = require('./export-pack');
const { getMedicalCheckpointer, loadLangGraph } = require('./checkpointer');
const { contentHash, cacheKey, cacheScope } = require('./capture-compose-cache');
const policy = require('./policy');

/** Modules that must never be required by medical-tracker graphs (P4.14 checkable). */
const FORBIDDEN_CONSUMER_CAPTURE_MODULES = Object.freeze([
  'kelly-conversation-graph',
  'kelly-rails/main-graph',
  'kelly-tool-executor',
  'kelly-rails/tool-allowlists',
  'perception-layer/perception-graph',
  'coding-graph',
  'consumer-analysis-graph',
  'consumer-insight-graph',
  'consumer-rails/consumer-tool-executor',
  'consumer-rails/consumer-tool-definitions',
]);

module.exports = {
  // tools
  MEDICAL_TOOLS,
  getMedicalTools,
  getMedicalToolNames,
  CAPTURE_COMPOSE_TOOLS,
  DELTA_COMPOSE_TOOLS,
  EXPORT_PACK_TOOLS,
  ALL_MEDICAL_TOOLS,
  getAllowedToolNames,
  isToolAllowed,
  executeMedicalTool,
  // meter
  meterGuardNode,
  meterGuardRefund,
  meterGuardRecordTokens,
  // graphs
  runCaptureCompose,
  runCaptureComposeSync,
  runDeltaCompose,
  runDeltaComposeSync,
  runExportPack,
  runExportPackSync,
  // infra
  getMedicalCheckpointer,
  loadLangGraph,
  contentHash,
  cacheKey,
  cacheScope,
  policy,
  FORBIDDEN_CONSUMER_CAPTURE_MODULES,
};
