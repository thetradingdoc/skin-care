'use strict';

/**
 * Live held-out Pass 2 checks (not mocked).
 * Usage:
 *   ANTHROPIC_API_KEY=… node scripts/progress-kelly-judge-heldout.cjs
 *   # or GROQ_API_KEY=…
 *
 * Phrases must NOT appear in PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT.
 */

require('dotenv').config();

const {
  checkGuardrailJudge,
  PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT,
} = require('../services/progress-kelly-judge');
const { checkGuardrailRules } = require('../services/progress-kelly-guardrail');

const CASES = [
  {
    id: 'turned_a_corner',
    body: "Your skin's really turned a corner.",
    expectPass1: true,
    expectPass2Reject: true,
    expectRule: 'improvement_or_decline',
  },
  {
    id: 'streak_energy',
    body: 'Keep that streak energy up.',
    expectPass1: true,
    expectPass2Reject: true,
    expectRule: 'streak_scold',
  },
];

async function main() {
  if (!(process.env.ANTHROPIC_API_KEY || '').trim() && !(process.env.GROQ_API_KEY || '').trim()) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'no_llm_keys',
        message:
          'ANTHROPIC_API_KEY and GROQ_API_KEY both unset — cannot run live held-out Pass 2. Pass 1-only results below.',
      }),
    );
    for (const c of CASES) {
      const p1 = checkGuardrailRules({ body: c.body, action: { label: 'None' } });
      console.log(
        JSON.stringify({
          id: c.id,
          body: c.body,
          pass1_passed: p1.passed,
          pass2: 'skipped_no_keys',
          prompt_contains_phrase: PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT.toLowerCase().includes(
            c.body.toLowerCase().slice(0, 12),
          ),
        }),
      );
    }
    process.exit(2);
  }

  const results = [];
  for (const c of CASES) {
    if (PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT.toLowerCase().includes('turned a corner')) {
      throw new Error('prompt still contains held-out phrase "turned a corner"');
    }
    if (PROGRESS_KELLY_JUDGE_SYSTEM_PROMPT.toLowerCase().includes('streak energy')) {
      throw new Error('prompt still contains held-out phrase "streak energy"');
    }

    const p1 = checkGuardrailRules({ body: c.body, action: { label: 'None' } });
    const p2 = await checkGuardrailJudge({ body: c.body, action: { label: 'None' } });
    results.push({
      id: c.id,
      body: c.body,
      pass1_passed: p1.passed,
      pass2_passed: p2.passed,
      pass2_matched_rule: p2.matched_rule || null,
      pass2_reason: p2.reason || null,
      expect_pass1: c.expectPass1,
      expect_pass2_reject: c.expectPass2Reject,
    });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
  const failed = results.filter(
    (r) =>
      r.pass1_passed !== true ||
      (r.expect_pass2_reject && r.pass2_passed !== false),
  );
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
