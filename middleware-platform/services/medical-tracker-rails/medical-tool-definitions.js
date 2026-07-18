'use strict';

/**
 * P4.01 — Medical-tracker tool definitions.
 * Separate from consumer-rails / Kelly — never mix allowlists.
 */

const MEDICAL_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_extract',
      description:
        'Extract text from stored medical media (OCR/PDF) for bill/lab/prescription/other tags. Meted AI path must go through meter_guard first.',
      parameters: {
        type: 'object',
        properties: {
          storage_ref: { type: 'string' },
          mime_type: { type: 'string' },
          file_name: { type: 'string' },
          buffer_base64: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'normalize_facts',
      description: 'Validate and normalize structured_json for a medical tag (skin|bill|prescription|mark|lab|other).',
      parameters: {
        type: 'object',
        required: ['tag', 'structured_json'],
        properties: {
          tag: { type: 'string' },
          structured_json: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_language',
      description: 'Stub language detect on OCR text (editable on confirm). Not a translation model.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'structure_by_tag',
      description: 'Structure OCR/vision output into a confirm draft. AI content must live under ai_suggestion only.',
      parameters: {
        type: 'object',
        required: ['tag'],
        properties: {
          tag: { type: 'string' },
          ocr_text: { type: 'string' },
          vision: { type: 'object' },
          user_hints: { type: 'object' },
          mime_type: { type: 'string' },
          file_name: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assess_quality',
      description: 'Unmetered quality gate before AI capture.',
      parameters: {
        type: 'object',
        properties: {
          mime_type: { type: 'string' },
          tag: { type: 'string' },
          buffer_base64: { type: 'string' },
          meta: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'format_confirm_draft',
      description: 'Format confirm payload with user fields and ai_suggestion kept separate.',
      parameters: {
        type: 'object',
        required: ['tag', 'structured_json'],
        properties: {
          tag: { type: 'string' },
          structured_json: { type: 'object' },
          raw_extract_text: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_prior_skin_facts',
      description: 'List prior confirmed skin facts for delta_compose (worse/same/calmer suggestion).',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          before_date: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_facts_for_export',
      description: 'Retrieval-only list of facts + media refs for physician export_pack. No AI narrative.',
      parameters: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          start: { type: 'string' },
          end: { type: 'string' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'suggest_skin_delta',
      description:
        'Produce AI SUGGESTS worse|same|calmer for skin delta. Output is always ai_suggestion — never write into note/body_area.',
      parameters: {
        type: 'object',
        required: ['prior_structured', 'today_structured'],
        properties: {
          prior_structured: { type: 'object' },
          today_structured: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  },
];

function getMedicalTools() {
  return MEDICAL_TOOLS.map((t) => ({ ...t, function: { ...t.function } }));
}

function getMedicalToolNames() {
  return MEDICAL_TOOLS.map((t) => t.function.name);
}

module.exports = {
  MEDICAL_TOOLS,
  getMedicalTools,
  getMedicalToolNames,
};
