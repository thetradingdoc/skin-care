'use strict';

/**
 * Progress Kelly LLM-judge guardrail (Step 4 / Pass 2).
 * Runs only after Pass 1 regex passes. Catches paraphrases / implications.
 *
 * Primitive: LLMRouter.call with NO tools — not runConsumerLlmStep.
 *
 * CLAIMS OWNERSHIP: Judge prompt + Pass 1 regex need a named App Store /
 * claims owner (unassigned in-repo). Engineering maintains code; do not
 * treat silent model-alias drift as acceptable — model is pinned below.
 */

const { z } = require('zod');
const LLMRouter = require('./llm-router');
const { parseJsonFromLlm } = require('./consumer-rails/node-runner');

const JUDGE_RULE_IDS = [
  'percentage_or_score',
  'diagnostic_language',
  'guaranteed_outcome',
  'improvement_or_decline',
  'week_count_milestone',
  'streak_scold',
];

/**
 * Pinned Progress Kelly judge model — independent of shared KELLY_* defaults.
 * Anthropic pin: PROGRESS_KELLY_JUDGE_MODEL (default claude-sonnet-4-5)
 * Groq pin (when no Anthropic key): PROGRESS_KELLY_JUDGE_GROQ_MODEL
 */
const PROGRESS_KELLY_JUDGE_MODEL =
  process.env.PROGRESS_KELLY_JUDGE_MODEL || 'claude-sonnet-4-5';
const PROGRESS_KELLY_JUDGE_GROQ_MODEL =
  process.env.PROGRESS_KELLY_JUDGE_GROQ_MODEL || 'llama-3.3-70b-versatile';

function resolveJudgeLlmOpts() {
  if ((process.env.ANTHROPIC_API_KEY || '').trim()) {
    return { forceProvider: 'anthropic', model: PROGRESS_KELLY_JUDGE_MODEL };
  }
  return { forceProvider: 'groq', model: PROGRESS_KELLY_JUDGE_GROQ_MODEL };
}

const progressKellyJudgeSchema = z
  .object({
    passed: z.boolean(),
    matched_rule: z.enum([...JUDGE_RULE_IDS, 'none']).nullable(),
    reason: z.string().min(1).max(160),
  })
  .strict();

const PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT = `You are a safety judge for Progress Kelly messages in the skiñcare app.

You receive ONLY a candidate message (body + action label). You do not receive tool data, user history, or generation context.

Judge whether the message violates ANY of these rules — including paraphrases and implications, not only literal keywords:

1. percentage_or_score — percentages, numeric scores, or rating claims
2. diagnostic_language — diagnoses, naming a condition as fact about the user
3. guaranteed_outcome — promises the mark will fade/clear/cure/erase
4. improvement_or_decline — implies the mark got better or worse over time (paraphrase or implication counts; do not require the words better/worse/improving). Quoting the user's own logged check-in words (worse/same/calmer) as counts is OK; asserting "you're looking worse/better" is not.
5. week_count_milestone — uses week counts as progress/milestone framing. Protocol cadence like "twice a week" is OK. Calendar windows next to logged counts (e.g. "logged worse 2 days this week") are OK.
6. streak_scold — scolds or pressures about streaks or missed days, OR praise/encouragement that implies a streak obligation

If ANY rule is violated, set passed=false and matched_rule to that rule id.
If none are violated, set passed=true and matched_rule=null.

Respond with a single JSON object only (no markdown fences):
{"passed":true|false,"matched_rule":"<rule_id>"|null,"reason":"<one line max 160 chars>"}

Do not include any other keys. Do not invent extra rule ids.`;

function parseJudgePayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, reason: 'judge_schema_validation_failed' };
  }
  const candidate = { ...raw };
  if (candidate.matched_rule === undefined && candidate.violated_rule !== undefined) {
    candidate.matched_rule = candidate.violated_rule;
  }
  delete candidate.violated_rule;

  const parsed = progressKellyJudgeSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      success: false,
      reason: 'judge_schema_validation_failed',
      issues: parsed.error?.issues || null,
    };
  }
  const data = parsed.data;
  if (data.passed === true && data.matched_rule != null && data.matched_rule !== 'none') {
    return { success: false, reason: 'judge_schema_validation_failed' };
  }
  if (data.passed === false && (data.matched_rule == null || data.matched_rule === 'none')) {
    return { success: false, reason: 'judge_schema_validation_failed' };
  }
  return {
    success: true,
    result: {
      passed: data.passed,
      matched_rule: data.passed ? null : data.matched_rule,
      reason: data.reason,
    },
  };
}

/**
 * @param {{ body?: string, action?: { label?: string } }} message
 */
async function checkGuardrailJudge(message) {
  const body = String(message?.body || '');
  const label = String(message?.action?.label || '');
  const userContent = [
    `body: ${JSON.stringify(body)}`,
    `action.label: ${JSON.stringify(label)}`,
    'Judge this candidate message only.',
  ].join('\n');

  let response;
  try {
    const llmOpts = resolveJudgeLlmOpts();
    response = await LLMRouter.call({
      messages: [
        { role: 'system', content: PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      channel: 'chat',
      maxTokens: 200,
      forceProvider: llmOpts.forceProvider,
      model: llmOpts.model,
    });
  } catch (e) {
    console.warn(
      '[progress-kelly-judge] llm_error:',
      JSON.stringify({ error: e.message, body, model: resolveJudgeLlmOpts().model }),
    );
    return {
      passed: false,
      reason: 'Judge LLM call failed',
      matched_rule: 'judge_error',
      judge_error: e.message,
    };
  }

  const content = String(response?.choices?.[0]?.message?.content || '').trim();
  const parsedJson = parseJsonFromLlm(content);
  const validated = parseJudgePayload(parsedJson);
  if (!validated.success) {
    console.warn(
      '[progress-kelly-judge] parse_failed:',
      JSON.stringify({ body, llm_raw: content.slice(0, 400) }),
    );
    return {
      passed: false,
      reason: 'Judge response failed schema validation',
      matched_rule: 'judge_parse_failed',
      judge_error: validated.reason,
    };
  }

  if (!validated.result.passed) {
    console.warn(
      '[progress-kelly-judge] rejected:',
      JSON.stringify({
        matched_rule: validated.result.matched_rule,
        reason: validated.result.reason,
        body,
        action_label: label || null,
      }),
    );
    return {
      passed: false,
      reason: validated.result.reason,
      matched_rule: validated.result.matched_rule,
    };
  }

  return { passed: true };
}

module.exports = {
  checkGuardrailJudge,
  parseJudgePayload,
  progressKellyJudgeSchema,
  PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT,
  PROGRESS_KELLY_JUDGE_MODEL,
  PROGRESS_KELLY_JUDGE_GROQ_MODEL,
  resolveJudgeLlmOpts,
  JUDGE_RULE_IDS,
};
