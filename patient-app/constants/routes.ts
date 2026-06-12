import type { Href } from 'expo-router';

/** Typed route helpers (expo-router strict routes). */
export const SIGN_IN_HREF = '/sign-in' as Href;
export const ONBOARDING_SCAN_HREF = '/onboarding/scan' as Href;
export const ONBOARDING_REVEAL_HREF = '/onboarding/reveal' as Href;
export const ONBOARDING_CONCERNS_HREF = '/onboarding/concerns' as Href;
export const ONBOARDING_SIGNUP_HREF = '/onboarding/signup' as Href;
export const JOURNEY_CHOOSE_HREF = '/onboarding/journey-choose' as Href;
export const HOME_HREF = '/(tabs)/home' as Href;
/** @deprecated Use HOME_HREF */
export const TODAY_HREF = HOME_HREF;
export const TRACK_HREF = '/(tabs)/track' as Href;
export const PROGRESS_HREF = '/(tabs)/progress' as Href;
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

/** @deprecated Legacy billing capture modals — use v3 Scan / Track / Home flows. */
export const CAPTURE_SCAN_HREF = '/capture-scan' as Href;
/** @deprecated */
export const CHECKOUT_CHAT_HREF = '/checkout-chat' as Href;

export function trackCaptureHref(spotId?: string): Href {
  if (!spotId) return TRACK_CAPTURE_HREF;
  return `/track/capture?spotId=${encodeURIComponent(spotId)}` as Href;
}
