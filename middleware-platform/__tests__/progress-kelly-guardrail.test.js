'use strict';

jest.mock('../services/progress-kelly-judge', () => ({
  checkGuardrailJudge: jest.fn(async () => ({ passed: true })),
}));

const { checkGuardrailRules } = require('../services/progress-kelly-guardrail');
const { checkGuardrailJudge } = require('../services/progress-kelly-judge');
const { parseProgressKellyPayload } = require('../services/progress-kelly-schema');
const { validateGenerationFromLlmRaw } = require('../services/progress-kelly-graph');

describe('progress-kelly-guardrail (Step 3 Pass 1)', () => {
  beforeEach(() => {
    checkGuardrailJudge.mockClear();
    checkGuardrailJudge.mockResolvedValue({ passed: true });
    delete process.env.FEATURE_PROGRESS_KELLY_JUDGE;
  });

  test('rejects "looking better this week" via improvement', () => {
    const msg = {
      message_type: 'observation',
      body: 'Your skin is looking better this week',
      day_reference: null,
      action: { label: 'None', type: 'none' },
    };
    expect(parseProgressKellyPayload(msg).success).toBe(true);
    const guard = checkGuardrailRules(msg);
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('improvement_or_decline');
  });

  test('rejects percentage claims', () => {
    const guard = checkGuardrailRules({
      body: 'Clarity improved by 40%.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('percentage_or_score');
  });

  test('rejects diagnostic "you have eczema"', () => {
    const guard = checkGuardrailRules({
      body: 'You have eczema on this mark.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('diagnostic_language');
  });

  test('rejects guaranteed outcome "will fade"', () => {
    const guard = checkGuardrailRules({
      body: 'This mark will fade soon.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('guaranteed_outcome');
  });

  test('rejects week-count milestone "week 4"', () => {
    const guard = checkGuardrailRules({
      body: 'You reached week 4 of tracking.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('week_count_milestone');
  });

  test('allows protocol cadence "twice a week"', () => {
    const guard = checkGuardrailRules({
      body: 'Apply serum twice a week as logged.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(true);
  });

  test('rejects streak scold', () => {
    const guard = checkGuardrailRules({
      body: 'You missed your streak — get back on track.',
      action: { label: 'None' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('streak_scold');
  });

  test('allows factual day-count observation', () => {
    const guard = checkGuardrailRules({
      body: 'You have 2 photos logged for this mark.',
      action: { label: 'Compare' },
    });
    expect(guard.passed).toBe(true);
  });

  test('checks action.label as well as body', () => {
    const guard = checkGuardrailRules({
      body: 'Log another photo when ready.',
      action: { label: 'Get better' },
    });
    expect(guard.passed).toBe(false);
    expect(guard.matched_rule).toBe('improvement_or_decline');
  });

  test('shared validateGenerationFromLlmRaw returns guardrail_rejected with pass1 attribution', async () => {
    const raw = JSON.stringify({
      message_type: 'observation',
      body: 'Your skin is looking better this week',
      day_reference: null,
      action: { label: 'None', type: 'none' },
    });
    const out = await validateGenerationFromLlmRaw(raw);
    expect(out.success).toBe(false);
    expect(out.reason).toBe('guardrail_rejected');
    expect(out.guardrail_pass).toBe('pass1');
    expect(out.matched_rule).toBe('improvement_or_decline');
    expect(checkGuardrailJudge).not.toHaveBeenCalled();
  });
});
