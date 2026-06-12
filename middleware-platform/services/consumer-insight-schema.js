'use strict';

const { z } = require('zod');

const insightSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['info', 'watch', 'caution']).optional(),
  barrier_note: z.string().nullable().optional(),
  skin_note: z.string().nullable().optional(),
});

function parseInsightPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = insightSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    title: parsed.data.title,
    message: parsed.data.message,
    severity: parsed.data.severity || 'info',
    barrier_note: parsed.data.barrier_note ?? null,
    skin_note: parsed.data.skin_note ?? null,
  };
}

module.exports = { insightSchema, parseInsightPayload };
