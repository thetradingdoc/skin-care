/**
 * Unlock AI (T8) purchase surface gate (cap/burst entry points).
 *
 * Apple App Store Review Guidelines §3.1.1 (live developer.apple.com text, reviewed 2026-07-17):
 * digital unlocks / credits consumed in-app must use In-App Purchase unless an allowed
 * exception applies.
 *
 * Cap/burst: hide "See options" when this returns false (no StoreKit yet).
 * Unlock / Care screens: platform split uses external-browser Linking.openURL for
 * pricing CTAs (see lib/billing-platform-checkout.ts) — not in-app Elements/WebView.
 *
 * G-IAP: iOS defaults OFF for cap/burst entry and cannot be silently flipped ON via env
 * in release builds. FUTURE: StoreKit 2 products for credit packs + Plus.
 */
import { Platform } from 'react-native';

/** Env override: "0" / "false" forces off everywhere; "1" / "true" forces on (dev only on iOS). */
function envOverride(): boolean | null {
  const raw = String(process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === '1' || raw === 'true' || raw === 'on') return true;
  return null;
}

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Whether Unlock AI purchase *entry* from cap/burst may be offered.
 * @param os — inject Platform.OS in tests (default live Platform.OS)
 */
export function isUnlockAiPurchaseEnabled(os: string = Platform.OS): boolean {
  const override = envOverride();

  // App Store iOS — locked OFF for cap/burst. Env can force off; env cannot force on outside __DEV__.
  if (os === 'ios') {
    if (override === false) return false;
    if (override === true && isDevBuild()) return true;
    return false;
  }

  if (override != null) return override;
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
