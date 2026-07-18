/**
 * Unlock AI (T8) purchase surface gate.
 *
 * Apple App Store Review Guidelines §3.1.1 (live developer.apple.com text, reviewed 2026-07-17):
 * digital unlocks / credits consumed in-app must use In-App Purchase unless an allowed
 * exception applies (US storefront external CTAs under 3.1.1(a), regional StoreKit External
 * Purchase Link entitlements, reader apps, etc.). AI read credits are digital goods used
 * inside the app — Stripe Linking.openURL is not a compliant default for App Store iOS.
 *
 * Decision for this TestFlight: hide purchase CTAs on iOS. Keep Stripe checkout code path
 * for web / later StoreKit. Existing Plus/credits entitlements from the API are unchanged —
 * this only blocks new in-app purchase attempts on iOS.
 *
 * FUTURE: StoreKit 2 products for credit packs + Plus (separate pass — do not rush).
 */
import { Platform } from 'react-native';

/** Env override: "0" / "false" forces off everywhere; "1" / "true" forces on (dev only). */
function envOverride(): boolean | null {
  const raw = String(process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return null;
}

/**
 * Whether Unlock AI Stripe/StoreKit purchase UI may be offered.
 * @param os — inject Platform.OS in tests (default live Platform.OS)
 */
export function isUnlockAiPurchaseEnabled(os: string = Platform.OS): boolean {
  const override = envOverride();
  if (override != null) return override;
  // App Store binary — hide until StoreKit ships
  if (os === 'ios') return false;
  // Web: Stripe OK (not App Store). Android: keep until Play Billing decision (see report).
  return true;
}

export const UNLOCK_AI_IOS_PAUSED_TITLE = 'More AI reads';
export const UNLOCK_AI_IOS_PAUSED_BODY =
  'Buying more AI reads is not available in the App Store build yet. Manual logging stays free and unlimited — you can keep logging without AI.';

export const AI_CAP_BODY_WITH_UNLOCK =
  'you can still log this manually right now, free, no limit — or unlock more AI reads';

export const AI_CAP_BODY_MANUAL_ONLY =
  'you can still log this manually right now — free, no limit. AI reads reset next month.';
