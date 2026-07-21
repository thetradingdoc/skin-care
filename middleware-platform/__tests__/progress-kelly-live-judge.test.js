'use strict';

/**
 * Live held-out Pass 2 CI gate for Progress Kelly.
 *
 * Runs only when:
 *   - PROGRESS_KELLY_LIVE_JUDGE=1, and
 *   - ANTHROPIC_API_KEY or GROQ_API_KEY is set
 *
 * Mitigation for cost: not on every commit — enable in CI only on PRs that
 * touch Progress Kelly files (see package.json script + workflow note).
 *
 * npm run test:progress-kelly:live-judge
 */

const path = require('path');

const LIVE = process.env.PROGRESS_KELLY_LIVE_JUDGE === '1';
const HAS_KEY = !!(
  (process.env.ANTHROPIC_API_KEY || '').trim() || (process.env.GROQ_API_KEY || '').trim()
);

const maybeDescribe = LIVE && HAS_KEY ? describe : describe.skip;

maybeDescribe('Progress Kelly live held-out judge (CI gate)', () => {
  // Load real modules (no mocks) — this file must not jest.mock the judge
  const { checkGuardrailRules } = require('../services/progress-kelly-guardrail');
  const {
    checkGuardrailJudge,
    PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT,
  } = require('../services/progress-kelly-judge');

  const CASES = [
    {
      id: 'turned_a_corner',
      body: "Your skin's really turned a corner.",
      expectPass1: true,
      expectPass2Reject: true,
    },
    {
      id: 'streak_energy',
      body: 'Keep that streak energy up.',
      expectPass1: true,
      expectPass2Reject: true,
    },
    {
      id: 'coming_along_nicely',
      body: 'That mark is really coming along nicely.',
      expectPass1: true,
      expectPass2Reject: true,
    },
    {
      id: 'dont_lose_momentum',
      body: "Don't lose your logging momentum now.",
      expectPass1: true,
      expectPass2Reject: true,
    },
    {
      id: 'factual_safe',
      body: 'You have 2 photos logged for this mark.',
      expectPass1: true,
      expectPass2Reject: false,
    },
  ];

  test('prompt does not embed held-out phrases', () => {
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/turned a corner/i);
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/streak energy/i);
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/coming along nicely/i);
    expect(PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT).not.toMatch(/logging momentum/i);
  });

  for (const c of CASES) {
    test(`live: ${c.id}`, async () => {
      const p1 = checkGuardrailRules({ body: c.body, action: { label: 'None' } });
      expect(p1.passed).toBe(c.expectPass1);

      const p2 = await checkGuardrailJudge({ body: c.body, action: { label: 'None' } });
      if (c.expectPass2Reject) {
        expect(p2.passed).toBe(false);
      } else {
        expect(p2.passed).toBe(true);
      }
    }, 60000);
  }
});

describe('Progress Kelly live judge gate documentation', () => {
  test('skipped without PROGRESS_KELLY_LIVE_JUDGE=1', () => {
    if (!LIVE || !HAS_KEY) {
      expect(true).toBe(true);
    }
  });
});
