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
/** TOUCH-031/033 — Check route retained only as a deep-link redirect target (Phase D). */
export const CHECK_HREF = '/check' as Href;
/** @deprecated Severity sheet retired — /severity redirects to capture (Phase D). */
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
export const TRACK_HREF = '/(tabs)/track' as Href;
export const PROGRESS_HREF = '/(tabs)/progress' as Href;
/** P7.01 — Calendar tab */
export const CALENDAR_HREF = '/(tabs)/calendar' as Href;
/** P7.01 — Shelf tab */
export const SHELF_HREF = '/(tabs)/shelf' as Href;
/** P7.01 — Profile tab (account route) */
export const PROFILE_HREF = '/(tabs)/account' as Href;
export const ACCOUNT_HREF = PROFILE_HREF;
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
  /** Phase D — legacy spot URLs redirect via track/[spotId] → mark-compare */
  return `/track/${encodeURIComponent(spotId)}` as Href;
}

export const TRACK_CAPTURE_HREF = '/track/capture' as Href;

/** P7.33–37 — capture second-tier screens */
export const CAMERA_DENIED_HREF = '/capture/camera-denied' as Href;
export const VISION_FAIL_HREF = '/capture/vision-fail' as Href;
export const MANUAL_ENTRY_HREF = '/capture/manual-entry' as Href;
export const OPQRST_LITE_HREF = '/capture/opqrst-lite' as Href;
export const ROUTINE_NUDGE_HREF = '/capture/routine-nudge' as Href;

/** P7.38–39 — OTP screens */
export const OTP_ENTRY_HREF = '/auth/otp-entry' as Href;
export const OTP_ERROR_HREF = '/auth/otp-error' as Href;

/** P7.40–42 — Profile destinations */
export const PROFILE_ALLERGENS_HREF = '/profile/allergens' as Href;
export const PROFILE_NOTIFICATIONS_HREF = '/profile/notifications' as Href;
export const PROFILE_CONSENT_HREF = '/profile/consent-privacy' as Href;

/** P7.43 — Rx refill info (real destination) */
export const RX_REFILL_INFO_HREF = '/shelf/rx-refill-info' as Href;

/** P7.04 / P7.24–25 capture flow */
/** Frame 1 — pre-capture disclosure (cold path). Not Profile consent-privacy. */
export const CAPTURE_CONSENT_HREF = '/capture/consent' as Href;
export const CAPTURE_2A_HREF = '/capture' as Href;
/** Authenticated home = Progress (P7.03). Check is retired (Phase D). */
export const HOME_HREF = PROGRESS_HREF;
/** @deprecated Use CAPTURE_2A_HREF for photo CTAs; HOME_HREF for lander */
export const TODAY_HREF = CAPTURE_2A_HREF;
export const CAPTURE_TAG_HREF = '/capture/tag' as Href;
export const CAPTURE_LOADING_HREF = '/capture/loading' as Href;
export const MARK_PICKER_HREF = '/capture/mark-picker' as Href;
export const MARK_COMPARE_HREF = '/capture/mark-compare' as Href;
export const DAILY_AI_SUGGESTS_HREF = '/capture/daily-ai-suggests' as Href;
export const AI_CAP_HREF = '/capture/ai-cap' as Href;
export const AI_BURST_HREF = '/capture/ai-burst' as Href;
export const UNLOCK_AI_HREF = '/capture/unlock-ai' as Href;
export const WELCOME_BONUS_HREF = '/capture/welcome-bonus' as Href;
export const WELCOME_HREF = '/welcome' as Href;
export const PROFILE_LANGUAGE_HREF = '/profile/language' as Href;
export const PROFILE_SHARE_DOCTOR_HREF = '/profile/share-with-doctor' as Href;
export const ALERTS_HISTORY_HREF = '/alerts' as Href;

/** P7.18–23 — per-tag capture reveal screens (separate routes). */
export const REVEAL_SKIN_HREF = '/capture/reveal/skin' as Href;
export const REVEAL_BILL_HREF = '/capture/reveal/bill' as Href;
export const REVEAL_RX_HREF = '/capture/reveal/rx' as Href;
export const REVEAL_MARK_HREF = '/capture/reveal/mark' as Href;
export const REVEAL_LAB_HREF = '/capture/reveal/lab' as Href;
export const REVEAL_OTHER_HREF = '/capture/reveal/other' as Href;

export function revealHrefForTag(
  tag: 'skin' | 'bill' | 'rx' | 'mark' | 'lab' | 'other',
): Href {
  switch (tag) {
    case 'skin':
      return REVEAL_SKIN_HREF;
    case 'bill':
      return REVEAL_BILL_HREF;
    case 'rx':
      return REVEAL_RX_HREF;
    case 'mark':
      return REVEAL_MARK_HREF;
    case 'lab':
      return REVEAL_LAB_HREF;
    case 'other':
      return REVEAL_OTHER_HREF;
    default: {
      const _exhaustive: never = tag;
      return _exhaustive;
    }
  }
}

export function confirmHrefForTag(
  tag: 'skin' | 'bill' | 'rx' | 'mark' | 'lab' | 'other',
): Href {
  return `/capture/confirm/${tag}` as Href;
}

export function thesisHrefForTag(
  tag: 'skin' | 'bill' | 'rx' | 'mark' | 'lab' | 'other',
): Href {
  return `/capture/thesis/${tag}` as Href;
}

/** Landing SPA paths (site root, not /app). */
export const LANDING_ORIGIN = 'https://trytouche.com';
export const LANDING_HOME_HREF = '/';
export const LANDING_SCAN_HREF = '/scan';
export const LANDING_CONCERNS_HREF = '/concerns';

/** @deprecated Deleted route — use TRACK_CAPTURE_HREF or /scan-entry for bill CTAs. */
export const CAPTURE_SCAN_HREF = TRACK_CAPTURE_HREF;

export function trackCaptureHref(spotId?: string): Href {
  if (!spotId) return TRACK_CAPTURE_HREF;
  return `/track/capture?spotId=${encodeURIComponent(spotId)}` as Href;
}
