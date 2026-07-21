'use strict';

/**
 * Minimal static fallback when generation or guardrails fail.
 * Always schema-valid — never leave the caller without user-facing copy.
 *
 * OWNERSHIP: Progress Kelly claims/compliance owner TBD — do not treat this
 * copy as final marketing voice.
 */

const STATIC_FALLBACK_MESSAGE = Object.freeze({
  message_type: 'prompt',
  body: "Having trouble finding the right words — check back shortly.",
  day_reference: null,
  action: Object.freeze({ label: 'None', type: 'none' }),
});

/**
 * @param {object} [failure] — prior typed failure (reason, matched_rule, …)
 * @returns {{ success: true, message: object, fallback: true, prior_failure?: object }}
 */
function buildProgressKellyFallback(failure = null) {
  return {
    success: true,
    message: { ...STATIC_FALLBACK_MESSAGE, action: { ...STATIC_FALLBACK_MESSAGE.action } },
    fallback: true,
    prior_failure: failure
      ? {
          reason: failure.reason || null,
          matched_rule: failure.matched_rule || null,
          guardrail_pass: failure.guardrail_pass || null,
          error: failure.error || null,
        }
      : null,
  };
}

module.exports = {
  STATIC_FALLBACK_MESSAGE,
  buildProgressKellyFallback,
};
