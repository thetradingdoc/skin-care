'use strict';

/**
 * Progress Kelly deterministic guardrail (Step 3 / Pass 1).
 * Content checks on body + action.label after schema validation succeeds.
 * Reject whole message on match — never auto-edit.
 *
 * Returns on the FIRST matched rule category (does not collect all matches).
 * Rejection logs should be read as "first hit," not "only violation."
 *
 * CLAIMS OWNERSHIP: Pass 1 regex list needs a named App Store / claims owner
 * (engineering maintains code; claims risk sign-off is unassigned in-repo).
 */

/** @typedef {{ passed: true } | { passed: false, reason: string, matched_rule: string }} GuardrailResult */

const CHECK_IN_DELTAS = ['worse', 'same', 'calmer'];

/**
 * User self-report quote framing — Kelly citing logged check-in vocabulary,
 * not asserting her own judgment. Divide of labor: Pass 1 allows these quotes;
 * Pass 2 still catches asserted judgment paraphrases.
 */
function isCheckInSelfReportFraming(haystack) {
  const t = String(haystack || '');
  // "You logged worse 2 days" / "logged calmer three days this week"
  if (/\b(?:you\s+)?logged\s+(?:worse|same|calmer)\b/i.test(t)) return true;
  if (/\b(?:worse|same|calmer)\s+days?\s+logged\b/i.test(t)) return true;
  return false;
}

const RULES = [
  {
    id: 'percentage_or_score',
    reason: 'Message contains a percentage or numeric-score claim',
    patterns: [
      /\d+\s*%/,
      /\bpercent(?:age)?\b/i,
      /\bscore\s+of\b/i,
      /\bscored\b/i,
      /\b\d+\s*\/\s*\d+\b/,
    ],
  },
  {
    id: 'diagnostic_language',
    reason: 'Message contains diagnostic language',
    patterns: [
      /\bdiagnos(?:is|e|ed|ing|es|tic)\b/i,
      /\byou\s+have\s+(?:a\s+|an\s+)?(?:melanoma|eczema|psoriasis|rosacea|dermatitis|infection|cancer)\b/i,
      /\bthis\s+is\s+(?:a\s+|an\s+)?(?:melanoma|eczema|psoriasis|rosacea|dermatitis|infection|cancer)\b/i,
      /\byou\s+(?:are|re)\s+diagnosed\b/i,
    ],
  },
  {
    id: 'guaranteed_outcome',
    reason: 'Message contains guaranteed-outcome phrasing',
    patterns: [
      /\bwill\s+fade\b/i,
      /\bguaranteed\b/i,
      /\bcured\b/i,
      /\berased\b/i,
      /\b(?:fully\s+)?cleared\b/i,
      /\bwill\s+clear\b/i,
      /\bguarantees?\b/i,
    ],
  },
  {
    id: 'improvement_or_decline',
    reason: 'Message implies improvement or decline of the mark',
    patterns: [
      /\bbetter\b/i,
      /\bworse\b/i,
      /\bimprov(?:e|es|ed|ing|ement)\b/i,
      /\bclearing\s+up\b/i,
      /\bworking\b/i,
      /\bdeclin(?:e|es|ed|ing)\b/i,
      /\bdeteriorat(?:e|es|ed|ing)\b/i,
      /\bgot\s+(?:better|worse)\b/i,
      /\bgetting\s+(?:better|worse)\b/i,
      /\blooking\s+worse\b/i,
    ],
  },
  {
    id: 'week_count_milestone',
    reason: 'Message uses week-count as a milestone or progress marker',
    patterns: [
      /\bweek\s+\d+\b/i,
      /\bweek\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
      /\b(?:this|last|next)\s+week\b/i,
      /\bin\s+\d+\s+weeks?\b/i,
      /\bafter\s+\d+\s+weeks?\b/i,
      /\b\d+\s*-?\s*week\s+(?:mark|milestone|checkpoint|plan|progress)\b/i,
    ],
  },
  {
    id: 'streak_scold',
    reason: 'Message frames a logging gap as a missed or broken streak',
    patterns: [
      /\bmissed\s+your\s+streak\b/i,
      /\bbroke\s+your\s+streak\b/i,
      /\bbroken\s+streak\b/i,
      /\bmissed\s+(?:your\s+)?(?:\d+\s+)?days?\b/i,
      /\byou\s+missed\b/i,
      /\bstreak\s+(?:is\s+)?(?:over|broken|reset)\b/i,
      /\bdon'?t\s+break\s+your\s+streak\b/i,
      /\bkeep\s+your\s+streak\b/i,
    ],
  },
];

/**
 * Patterns that remain banned even inside self-report framing
 * (Kelly asserting judgment, not quoting a log).
 */
const ASSERTION_DESPITE_QUOTE_CONTEXT = [
  /\blooking\s+(?:better|worse)\b/i,
  /\bgetting\s+(?:better|worse)\b/i,
  /\byou(?:'re| are)\s+looking\b/i,
];

function patternHitsWithQuotePolicy(ruleId, pattern, haystack) {
  if (!pattern.test(haystack)) return false;

  if (!isCheckInSelfReportFraming(haystack)) return true;

  // Self-report framing: still reject clear asserted judgment
  for (const assertPat of ASSERTION_DESPITE_QUOTE_CONTEXT) {
    if (assertPat.test(haystack)) return true;
  }

  if (ruleId === 'improvement_or_decline') {
    // Allow bare worse/same/calmer / better only when clearly in "logged …" framing
    // and not an assertion pattern above.
    const src = pattern.source;
    if (
      src.includes('worse') ||
      src.includes('better') ||
      CHECK_IN_DELTAS.some((d) => src.includes(d))
    ) {
      return false;
    }
    // Still block improv*/clearing up/working inside quote framing
    return true;
  }

  if (ruleId === 'week_count_milestone') {
    // Allow this/last/next week as a calendar window next to logged check-in counts.
    // Still block "week 4" / "in 3 weeks" milestone framing.
    if (/\(\?:this\|last\|next\)/.test(pattern.source)) {
      return false;
    }
    return true;
  }

  return true;
}

/**
 * @param {{ body?: string, action?: { label?: string } }} message
 * @returns {GuardrailResult}
 */
function checkGuardrailRules(message) {
  const body = String(message?.body || '');
  const label = String(message?.action?.label || '');
  const haystack = `${body}\n${label}`;

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      // Reset lastIndex for global patterns if any
      pattern.lastIndex = 0;
      if (patternHitsWithQuotePolicy(rule.id, pattern, haystack)) {
        console.warn(
          '[progress-kelly-guardrail] rejected:',
          JSON.stringify({
            matched_rule: rule.id,
            reason: rule.reason,
            body,
            action_label: label || null,
          }),
        );
        return {
          passed: false,
          reason: rule.reason,
          matched_rule: rule.id,
        };
      }
    }
  }

  return { passed: true };
}

module.exports = {
  checkGuardrailRules,
  RULES,
  isCheckInSelfReportFraming,
  CHECK_IN_DELTAS,
};
