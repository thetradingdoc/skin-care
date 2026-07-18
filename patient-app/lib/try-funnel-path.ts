/**
 * P7.13 — Pure try-* Shopify funnel path (testable without mounting RN screens).
 * Money path: handoff → verdict → allergens → reveal → sign-in.
 */

export const TRY_FUNNEL_STEPS = [
  'handoff',
  'verdict',
  'allergens',
  'reveal',
  'sign_in',
] as const;

export type TryFunnelStep = (typeof TRY_FUNNEL_STEPS)[number];

export const TRY_FUNNEL_HREFS: Readonly<Record<TryFunnelStep, string>> = Object.freeze({
  handoff: '/try-handoff',
  verdict: '/try-verdict',
  allergens: '/try-allergens',
  reveal: '/try-reveal',
  sign_in: '/sign-in',
});

export function nextTryFunnelStep(step: TryFunnelStep): TryFunnelStep | null {
  const i = TRY_FUNNEL_STEPS.indexOf(step);
  if (i < 0 || i >= TRY_FUNNEL_STEPS.length - 1) return null;
  return TRY_FUNNEL_STEPS[i + 1];
}

export function tryFunnelHref(step: TryFunnelStep): string {
  return TRY_FUNNEL_HREFS[step];
}

/**
 * Same trust gate as try-allergens before setTryRevealPayload.
 * Failed / missing overall must never be stashed for reveal.
 */
export function assertTryEvaluateReadyForReveal(
  verdict: Record<string, unknown> | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!verdict || typeof verdict !== 'object') {
    return { ok: false, reason: 'missing_verdict' };
  }
  if (verdict.success === false) {
    return { ok: false, reason: 'evaluate_failed' };
  }
  if (!verdict.overall) {
    return { ok: false, reason: 'missing_overall' };
  }
  const overall = String(verdict.overall).toLowerCase().trim();
  if (!overall || overall === 'unknown') {
    return { ok: false, reason: 'unknown_overall' };
  }
  return { ok: true };
}

/**
 * Mirrors try-reveal.tsx mapPrimary — kept pure so funnel tests catch Safe-on-error
 * without mounting the screen. Drift vs source is asserted in the funnel test.
 */
export function mapTryRevealPrimary(
  verdict: Record<string, unknown> | null | undefined,
): 'safe' | 'caution' | 'hard_no' | 'error' {
  if (!verdict || typeof verdict !== 'object') return 'error';
  if (verdict.success === false) return 'error';
  if (verdict.error != null && String(verdict.error).length > 0 && verdict.overall == null) {
    return 'error';
  }
  const overall = String(verdict.overall ?? '')
    .toLowerCase()
    .trim();
  if (!overall || overall === 'unknown') return 'error';
  if (overall === 'hard_no' || verdict.hard_no === true) return 'hard_no';
  if (overall === 'avoid') return 'hard_no';
  if (overall === 'caution') return 'caution';
  if (overall === 'safe') return 'safe';
  return 'error';
}
