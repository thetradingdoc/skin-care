'use strict';

/**
 * P4.02 — Medical-tracker tool allowlists.
 * MUST stay disjoint from consumer-rails shelf insight/journey tools and Kelly tools.
 */

const CAPTURE_COMPOSE_TOOLS = new Set([
  'assess_quality',
  'get_extract',
  'detect_language',
  'structure_by_tag',
  'normalize_facts',
  'format_confirm_draft',
]);

const DELTA_COMPOSE_TOOLS = new Set([
  'get_prior_skin_facts',
  'normalize_facts',
  'suggest_skin_delta',
  'format_confirm_draft',
]);

const EXPORT_PACK_TOOLS = new Set(['list_facts_for_export']);

/** All medical graphs — union for executor deny-by-default. */
const ALL_MEDICAL_TOOLS = new Set([
  ...CAPTURE_COMPOSE_TOOLS,
  ...DELTA_COMPOSE_TOOLS,
  ...EXPORT_PACK_TOOLS,
]);

function getAllowedToolNames(graphKind) {
  if (graphKind === 'capture_compose') return [...CAPTURE_COMPOSE_TOOLS];
  if (graphKind === 'delta_compose') return [...DELTA_COMPOSE_TOOLS];
  if (graphKind === 'export_pack') return [...EXPORT_PACK_TOOLS];
  return [];
}

function isToolAllowed(graphKind, name) {
  return getAllowedToolNames(graphKind).includes(String(name || ''));
}

module.exports = {
  CAPTURE_COMPOSE_TOOLS,
  DELTA_COMPOSE_TOOLS,
  EXPORT_PACK_TOOLS,
  ALL_MEDICAL_TOOLS,
  getAllowedToolNames,
  isToolAllowed,
};
