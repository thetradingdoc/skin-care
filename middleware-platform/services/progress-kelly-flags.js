'use strict';

/**
 * Progress Kelly feature flags (mirror FEATURE_V3_INSIGHTS pattern).
 * Defaults OFF — no real traffic until explicitly enabled.
 *
 * ---------------------------------------------------------------------------
 * INCIDENT / KILL-SWITCH POSTURE (read this before flipping flags in prod)
 * ---------------------------------------------------------------------------
 *
 * FEATURE_PROGRESS_KELLY (master):
 *   Full stop for generation. No LLM, no judge. Callers get the static
 *   fallback with reason feature_disabled / client_action render_fallback.
 *   This is the only flag that silences Progress Kelly generation.
 *
 * FEATURE_PROGRESS_KELLY_JUDGE=0 (Pass-2-only disable):
 *   Weakens the safety net — does NOT fully disable Kelly.
 *   Pass-1-clean messages ARE still generated and served to users.
 *   Mid-incident flip does NOT retroactively change in-flight requests that
 *   already passed the Pass-2 check point; each request reads the flag when
 *   it reaches that gate. Do not assume this flag alone stops Kelly output.
 * ---------------------------------------------------------------------------
 */

function isProgressKellyEnabled() {
  const v = process.env.FEATURE_PROGRESS_KELLY;
  return v === '1' || v === 'true' || v === 'TRUE';
}

/**
 * Pass 2 LLM judge. Default ON when Progress Kelly is on.
 * Set FEATURE_PROGRESS_KELLY_JUDGE=0 to run Pass-1-only (degraded mode).
 * See file header: this is NOT a full kill switch.
 */
function isProgressKellyJudgeEnabled() {
  const v = process.env.FEATURE_PROGRESS_KELLY_JUDGE;
  if (v === '0' || v === 'false' || v === 'FALSE') return false;
  return true;
}

module.exports = {
  isProgressKellyEnabled,
  isProgressKellyJudgeEnabled,
};
