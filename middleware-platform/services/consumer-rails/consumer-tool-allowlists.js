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

function getAllowedToolNames(graphKind) {
  if (graphKind === 'insight') return [...INSIGHT_TOOLS];
  if (graphKind === 'journey') return [...JOURNEY_TOOLS];
  return [];
}

module.exports = { INSIGHT_TOOLS, JOURNEY_TOOLS, getAllowedToolNames };
