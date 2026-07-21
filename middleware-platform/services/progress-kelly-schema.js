'use strict';

/**
 * Progress Kelly structured output schema (Step 2).
 * Same convention as consumer-insight-schema.js: zod + safeParse.
 *
 * .strict() makes percentage/score/week fields structurally impossible —
 * unknown keys fail validation; they are not in the schema.
 */

const { z } = require('zod');

const progressKellyActionSchema = z
  .object({
    label: z.string().min(1).max(20),
    type: z.enum(['compare', 'log_photo', 'none']),
  })
  .strict();

const progressKellyMessageSchema = z
  .object({
    message_type: z.enum(['observation', 'prompt', 'milestone']),
    body: z.string().min(1).max(160),
    day_reference: z.number().int().nullable(),
    action: progressKellyActionSchema,
  })
  .strict();

/**
 * @param {unknown} raw — object from parseJsonFromLlm (or null)
 * @returns {{ success: true, message: object } | { success: false, reason: 'schema_validation_failed', issues?: unknown }}
 */
function parseProgressKellyPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, reason: 'schema_validation_failed' };
  }
  const parsed = progressKellyMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      reason: 'schema_validation_failed',
      issues: parsed.error?.issues || null,
    };
  }
  return { success: true, message: parsed.data };
}

module.exports = {
  progressKellyMessageSchema,
  progressKellyActionSchema,
  parseProgressKellyPayload,
};
