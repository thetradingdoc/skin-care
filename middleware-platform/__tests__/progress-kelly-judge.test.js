'use strict';

jest.mock('../services/llm-router', () => ({
  call: jest.fn(),
}));

const LLMRouter = require('../services/llm-router');
const { checkGuardrailRules } = require('../services/progress-kelly-guardrail');
const {
  checkGuardrailJudge,
  parseJudgePayload,
  PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT,
  PROGRESS_KELLY_JUDGE_MODEL,
  resolveJudgeLlmOpts,
} = require('../services/progress-kelly-judge');
const { validateGenerationFromLlmRaw } = require('../services/progress-kelly-graph');

function judgeResponse(obj) {
  return {
    choices: [{ message: { content: JSON.stringify(obj) } }],
  };
}

describe('progress-kelly-judge (Step 4 Pass 2)', () => {
  beforeEach(() => {
    LLMRouter.call.mockReset();
    delete process.env.FEATURE_PROGRESS_KELLY_JUDGE;
  });

  test('judge prompt does not embed circular example phrases', () => {
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/looking noticeably lighter/i);
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/your consistency really shows/i);
  });

  test('judge model is pinned independently', () => {
    expect(PROGRESS_KELLY_JUDGE_MODEL).toBeTruthy();
    const opts = resolveJudgeLlmOpts();
    expect(opts.model).toBeTruthy();
    expect(opts.forceProvider).toMatch(/anthropic|groq/);
  });

  test('uses LLMRouter.call with pinned model, no tools', async () => {
    LLMRouter.call.mockResolvedValue(
      judgeResponse({
        passed: true,
        matched_rule: null,
        reason: 'Factual count only',
      }),
    );
    await checkGuardrailJudge({
      body: 'You have 2 photos logged for this mark.',
      action: { label: 'Compare' },
    });
    expect(LLMRouter.call).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'chat',
        model: expect.any(String),
        forceProvider: expect.any(String),
      }),
    );
    expect(LLMRouter.call.mock.calls[0][0].tools).toBeUndefined();
  });

  test('held-out: Pass 1 lets turned a corner through', () => {
    expect(
      checkGuardrailRules({
        body: "Your skin's really turned a corner.",
        action: { label: 'None' },
      }).passed,
    ).toBe(true);
  });

  test('shared path: Pass 1 short-circuits before judge', async () => {
    const raw = JSON.stringify({
      message_type: 'observation',
      body: 'Your skin is looking better this week',
      day_reference: null,
      action: { label: 'None', type: 'none' },
    });
    const out = await validateGenerationFromLlmRaw(raw);
    expect(out.success).toBe(false);
    expect(out.guardrail_pass).toBe('pass1');
    expect(LLMRouter.call).not.toHaveBeenCalled();
  });

  test('parseJudgePayload normalizes legacy violated_rule → matched_rule', () => {
    const out = parseJudgePayload({
      passed: false,
      violated_rule: 'streak_scold',
      reason: 'Implies streak obligation',
    });
    expect(out.success).toBe(true);
    expect(out.result.matched_rule).toBe('streak_scold');
  });
});
