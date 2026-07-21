/**
 * iOS App Store — Unlock AI / Plus commerce gates.
 *
 * Platform split (2026-07-19): Unlock screen shows pricing + external-browser CTA
 * (Linking.openURL). Cap/burst still hide "See options" purchase entry when
 * isUnlockAiPurchaseEnabled is false (no in-app StoreKit yet).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_CAP_BODY_MANUAL_ONLY,
  AI_CAP_BODY_WITH_UNLOCK,
  isUnlockAiPurchaseEnabled,
} from '@/lib/unlock-ai-commerce';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('isUnlockAiPurchaseEnabled', () => {
  const prev = process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;

  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;
    else process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE = prev;
  });

  it('is false on iOS (no StoreKit yet — cap/burst hide purchase entry)', () => {
    delete process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;
    expect(isUnlockAiPurchaseEnabled('ios')).toBe(false);
  });

  it('is true on web (Stripe allowed outside App Store binary)', () => {
    delete process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;
    expect(isUnlockAiPurchaseEnabled('web')).toBe(true);
  });

  it('is true on android until Play Billing decision (not this TF gate)', () => {
    delete process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;
    expect(isUnlockAiPurchaseEnabled('android')).toBe(true);
  });

  it('respects EXPO_PUBLIC_UNLOCK_AI_PURCHASE override', () => {
    process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE = '0';
    expect(isUnlockAiPurchaseEnabled('web')).toBe(false);
    process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE = '1';
    expect(isUnlockAiPurchaseEnabled('web')).toBe(true);
  });

  it('iOS ignores EXPO_PUBLIC_UNLOCK_AI_PURCHASE=1 outside __DEV__ (no silent flip-on)', () => {
    process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE = '1';
    expect(isUnlockAiPurchaseEnabled('ios')).toBe(
      typeof __DEV__ !== 'undefined' && __DEV__ === true,
    );
  });
});

describe('T6 AI cap — iOS coherent state (no broken unlock CTA)', () => {
  it('ai-cap gates See options behind isUnlockAiPurchaseEnabled', () => {
    const src = readFileSync(join(APP, 'capture/ai-cap.tsx'), 'utf8');
    expect(src).toMatch(/isUnlockAiPurchaseEnabled/);
    expect(src).toMatch(/ai-cap-manual/);
    expect(src).toMatch(/AI_CAP_BODY_MANUAL_ONLY/);
    expect(src).toMatch(/purchaseEnabled \? \(/);
    expect(src).toMatch(/ai-cap-options/);
    expect(src).toMatch(/Log manually instead/);
    expect(src).toMatch(/MANUAL_ENTRY_HREF/);
  });

  it('manual-only copy does not promise unlock purchase', () => {
    expect(AI_CAP_BODY_MANUAL_ONLY).toMatch(/manually/i);
    expect(AI_CAP_BODY_MANUAL_ONLY).toMatch(/free/i);
    expect(AI_CAP_BODY_MANUAL_ONLY).not.toMatch(/unlock more/i);
    expect(AI_CAP_BODY_WITH_UNLOCK).toMatch(/unlock more/i);
  });

  it('ai-burst likewise hides unlock CTA when purchase disabled', () => {
    const src = readFileSync(join(APP, 'capture/ai-burst.tsx'), 'utf8');
    expect(src).toMatch(/isUnlockAiPurchaseEnabled/);
    expect(src).toMatch(/ai-burst-manual/);
    expect(src).toMatch(/purchaseEnabled \? \(/);
    expect(src).toMatch(/ai-burst-unlock/);
  });
});

describe('T8 Unlock AI — external-browser platform split on iOS', () => {
  it('unlock-ai uses openBillingCheckoutUrl (Linking) — no AuthSession/WebView', () => {
    const src = readFileSync(join(APP, 'capture/unlock-ai.tsx'), 'utf8');
    expect(src).toMatch(/openBillingCheckoutUrl/);
    expect(src).toMatch(/\/api\/patient\/ai\/credits\/checkout/);
    expect(src).toMatch(/\/api\/patient\/ai\/plus\/checkout/);
    expect(src).toMatch(/unlock-choose/);
    expect(src).toMatch(/unlock-external-note/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
    expect(src).not.toMatch(/react-native-webview|<WebView\b|from ['\"]expo-web-browser['\"]/);
  });

  it('default vitest Platform is ios → external browser checkout UX', async () => {
    const { Platform } = await import('react-native');
    const { mustUseExternalBrowserCheckout } = await import('@/lib/billing-platform-checkout');
    expect(Platform.OS).toBe('ios');
    expect(mustUseExternalBrowserCheckout()).toBe(true);
  });
});

describe('Entitlements not corrupted by purchase UX', () => {
  it('usage meter / Plus consume path is not behind the purchase gate', () => {
    const chip = readFileSync(join(ROOT, 'components/track/TrackAiReadsChip.tsx'), 'utf8');
    expect(chip).toMatch(/\/api\/patient\/ai\/usage/);
    expect(chip).not.toMatch(/isUnlockAiPurchaseEnabled/);
    expect(chip).not.toMatch(/credits\/checkout/);

    const account = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(account).toMatch(/\/api\/patient\/ai\/usage/);
    expect(account).not.toMatch(/isUnlockAiPurchaseEnabled/);
  });
});
