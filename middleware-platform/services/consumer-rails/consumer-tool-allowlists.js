'use strict';

const INSIGHT_TOOLS = new Set([
  'get_bio_profile',
  'get_barrier_insight',
  'get_routine_phase',
  'retrieve_ingredient_monographs',
  'evaluate_lineup',
  'get_product_details',
]);

const JOURNEY_TOOLS = new Set([
  'get_consumer_profile',
  'get_active_spots',
  'evaluate_lineup',
  'get_barrier_insight',
  'get_shelf_products',
]);

/** Progress Kelly — confirmed mark facts + protocol counts only. No shelf/journey tools. */
const PROGRESS_TOOLS = new Set([
  'get_mark_facts',
  'get_protocol_adherence',
  'get_day_counts',
]);

function getAllowedToolNames(graphKind) {
  if (graphKind === 'insight') return [...INSIGHT_TOOLS];
  if (graphKind === 'journey') return [...JOURNEY_TOOLS];
  if (graphKind === 'progress') return [...PROGRESS_TOOLS];
  return [];
}

module.exports = { INSIGHT_TOOLS, JOURNEY_TOOLS, PROGRESS_TOOLS, getAllowedToolNames };
