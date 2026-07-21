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
  {
    type: 'function',
    function: {
      name: 'get_mark_facts',
      description:
        'List confirmed mark facts for a compare_group_id (mark_id): dates, location, label only.',
      parameters: {
        type: 'object',
        properties: { mark_id: { type: 'string' } },
        required: ['mark_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_protocol_adherence',
      description:
        'Counts of protocol daily logs in a window (logged days, entry/item counts). No percentages.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string' },
          window_days: { type: 'number' },
        },
        required: ['user_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day_counts',
      description:
        'Integer day counts for confirmed mark facts, plus last Progress Kelly message_type and date for this mark (type+date only, no prior message body). No week fields.',
      parameters: {
        type: 'object',
        properties: {
          user_id: { type: 'string' },
          mark_id: { type: 'string' },
        },
        required: ['user_id', 'mark_id'],
        additionalProperties: false,
      },
    },
  },
];

function getConsumerTools() {
  return CONSUMER_TOOLS;
}

module.exports = { CONSUMER_TOOLS, getConsumerTools };
