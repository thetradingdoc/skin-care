'use strict';

const CONSUMER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_consumer_profile',
      description: 'Load journey modes and onboarding flags for the patient.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bio_profile',
      description: 'Load skin conditions, prescriptions, and sensitivity profile.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_shelf_products',
      description: 'List products on the patient shelf with usage times.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_lineup',
      description: 'Run full routine compatibility evaluate (BFI, conflicts, step states).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_barrier_insight',
      description: 'Get recent barrier dip insight (drop points, pattern).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_spots',
      description: 'List spots being tracked with photo counts.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'retrieve_ingredient_monographs',
      description: 'Retrieve RAG evidence snippets for ingredient conflicts.',
      parameters: {
        type: 'object',
        properties: {
          ingredient_a: { type: 'string' },
          ingredient_b: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_routine_phase',
      description: 'Current program phase label for the active routine template.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get shelf product name and ingredients for insight context.',
      parameters: {
        type: 'object',
        properties: { product_id: { type: 'string' } },
        required: ['product_id'],
      },
    },
  },
];

function getConsumerTools() {
  return CONSUMER_TOOLS;
}

module.exports = { CONSUMER_TOOLS, getConsumerTools };
