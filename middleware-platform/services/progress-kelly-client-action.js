'use strict';

/**
 * Client contract for Progress Kelly responses (Decisions #24 / #29).
 *
 * client_action tells the API/UI what to do with the module:
 * - render          — show the generated Kelly message
 * - render_fallback — show the neutral static fallback ("Kelly tried and couldn't")
 * - suppress        — hide the Kelly module entirely (nothing new to say)
 *
 * status (when present):
 * - nothing_new — deliberate suppress; NOT a failure; message is null;
 *   do not conflate with render_fallback / safety rejections (#21 / #29).
 *
 * Mapping:
 * - successful generation → render
 * - guardrail_rejected, rate_limited, judge_error, llm_failed,
 *   schema_validation_failed, feature_disabled, … → render_fallback
 * - repeat_nudge_avoided → status nothing_new + suppress (no fallback body)
 */

const CLIENT_ACTIONS = Object.freeze({
  RENDER: 'render',
  RENDER_FALLBACK: 'render_fallback',
  SUPPRESS: 'suppress',
});

function resolveClientAction(result) {
  if (result?.status === 'nothing_new' || result?.reason === 'repeat_nudge_avoided') {
    return CLIENT_ACTIONS.SUPPRESS;
  }
  if (result && result.fallback === true) {
    if (result.prior_failure?.reason === 'repeat_nudge_avoided') {
      return CLIENT_ACTIONS.SUPPRESS;
    }
    return CLIENT_ACTIONS.RENDER_FALLBACK;
  }
  if (result && result.success === true && result.message) {
    return CLIENT_ACTIONS.RENDER;
  }
  return CLIENT_ACTIONS.RENDER_FALLBACK;
}

/**
 * Distinct shape for repeat-nudge suppress — not the static fallback channel.
 */
function buildNothingNewResult(extra = {}) {
  return withClientAction({
    success: true,
    status: 'nothing_new',
    reason: 'repeat_nudge_avoided',
    message: null,
    fallback: false,
    prior_failure: null,
    ...extra,
  });
}

function withClientAction(result) {
  if (!result || typeof result !== 'object') {
    return { client_action: CLIENT_ACTIONS.RENDER_FALLBACK };
  }
  return { ...result, client_action: resolveClientAction(result) };
}

module.exports = {
  CLIENT_ACTIONS,
  resolveClientAction,
  withClientAction,
  buildNothingNewResult,
};
