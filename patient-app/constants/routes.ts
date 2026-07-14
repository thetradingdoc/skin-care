import type { Href } from 'expo-router';

/** Typed route helpers (expo-router strict routes). */
export const SIGN_IN_HREF = '/sign-in' as Href;
/** TOUCH-013/015 — anonymous try-verdict entry (not face-age funnel). */
export const TRY_VERDICT_HREF = '/try-verdict' as Href;
/** TOUCH-014 — light Shopify → app handoff (no second marketing pitch). */
export const TRY_HANDOFF_HREF = '/try-handoff' as Href;
/** TOUCH-017 — allergen qualifier before reveal. */
export const TRY_ALLERGENS_HREF = '/try-allergens' as Href;
/** TOUCH-019–023 — reveal Safe/Caution/Hard-no. */
export const TRY_REVEAL_HREF = '/try-reveal' as Href;
/** TOUCH-028 — iOS-only Get-the-App interstitial after OTP. */
export const GET_THE_APP_HREF = '/get-the-app' as Href;
/** TOUCH-031/033 — Check = authenticated sole home (camera shell). */
export const CHECK_HREF = '/check' as Href;
/** TOUCH-040 — post-capture severity sheet */
export const SEVERITY_HREF = '/severity' as Href;
/** TOUCH-046 — Proof (rehomes Progress; not a tab) */
export const PROOF_HREF = '/proof' as Href;
/** TOUCH-056 — Bottle mode from Check */
export const BOTTLE_HREF = '/bottle' as Href;
/** TOUCH-066 — Alerts inbox (only when count > 0) */
export const ALERTS_HREF = '/alerts' as Href;
/** TOUCH-071 — Checkout honesty interstitial */
export const CHECKOUT_HANDOFF_HREF = '/checkout-handoff' as Href;
/** TOUCH-077/078 — Order confirmation + shelf result */
export const ORDER_CONFIRMATION_HREF = '/order-confirmation' as Href;
/** TOUCH-080 — Contextual shop browse */
export const SHOP_HREF = '/shop' as Href;
/** TOUCH-082 — Order history */
export const ORDERS_HREF = '/orders' as Href;
export const ONBOARDING_SCAN_HREF = '/onboarding/scan' as Href;

export function shopProductHref(handle: string): Href {
  return `/shop/${encodeURIComponent(handle)}` as Href;
}

export function checkoutHandoffHref(opts: {
  variantId?: string;
  handle?: string;
  mode?: 'cart' | 'pdp';
}): Href {
  const q = new URLSearchParams();
  if (opts.variantId) q.set('variantId', opts.variantId);
  if (opts.handle) q.set('handle', opts.handle);
  if (opts.mode) q.set('mode', opts.mode);
  const qs = q.toString();
  return (qs ? `/checkout-handoff?${qs}` : '/checkout-handoff') as Href;
}
export const ONBOARDING_REVEAL_HREF = '/onboarding/reveal' as Href;
export const ONBOARDING_CONCERNS_HREF = '/onboarding/concerns' as Href;
export const ONBOARDING_SIGNUP_HREF = '/onboarding/signup' as Href;
export const JOURNEY_CHOOSE_HREF = '/onboarding/journey-choose' as Href;
/** @deprecated Home tab removed — camera-first Check is sole home. */
export const HOME_HREF = CHECK_HREF;
/** @deprecated Use CHECK_HREF */
export const TODAY_HREF = CHECK_HREF;
export const TRACK_HREF = '/(tabs)/track' as Href;
export const PROGRESS_HREF = '/(tabs)/progress' as Href;
export const COMPARE_HREF = '/compare' as Href;
export const SCAN_HREF = '/(tabs)/scan' as Href;
export const ROUTINE_PICK_HREF = '/routine/pick' as Href;
export const BIO_CALIBRATION_HREF = '/onboarding/bio-calibration' as Href;
export const INDEX_HREF = '/' as Href;
/** @deprecated Legacy journal — redirects to Progress. Use PROGRESS_HREF. */
export const TIMELINE_HREF = PROGRESS_HREF;

export function verdictHref(productId: string): Href {
  return `/verdict/${encodeURIComponent(productId)}` as Href;
}

export function spotHref(spotId: string): Href {
  return `/track/${encodeURIComponent(spotId)}` as Href;
}

export const TRACK_CAPTURE_HREF = '/track/capture' as Href;

/** Landing SPA paths (site root, not /app). */
export const LANDING_ORIGIN = 'https://myskinandcare.com';
export const LANDING_HOME_HREF = '/';
export const LANDING_SCAN_HREF = '/scan';
export const LANDING_CONCERNS_HREF = '/concerns';

/** @deprecated Legacy billing capture modals — use v3 Scan / Track / Check flows. */
export const CAPTURE_SCAN_HREF = '/capture-scan' as Href;

export function trackCaptureHref(spotId?: string): Href {
  if (!spotId) return TRACK_CAPTURE_HREF;
  return `/track/capture?spotId=${encodeURIComponent(spotId)}` as Href;
}
