/**
 * iOS App Store — Unlock AI purchase paused until StoreKit.
 * Asserts: no purchase CTA on iOS cap/burst; unlock screen is paused (no Stripe Choose);
 * entitlements path (usage meter) untouched; Stripe code kept for non-iOS.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AI_CAP_BODY_MANUAL_ONLY,
  AI_CAP_BODY_WITH_UNLOCK,
  UNLOCK_AI_IOS_PAUSED_BODY,
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

  it('is false on iOS (App Store digital goods → StoreKit required / pending)', () => {
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
    expect(isUnlockAiPurchaseEnabled('ios')).toBe(true);
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
    // Primary escape always present
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

describe('T8 Unlock AI — iOS purchase not reachable', () => {
  it('unlock-ai keeps Stripe Linking path but gates it behind purchaseEnabled', () => {
    const src = readFileSync(join(APP, 'capture/unlock-ai.tsx'), 'utf8');
    expect(src).toMatch(/isUnlockAiPurchaseEnabled/);
    expect(src).toMatch(/Linking\.openURL/);
    expect(src).toMatch(/\/api\/patient\/ai\/credits\/checkout/);
    expect(src).toMatch(/if \(!purchaseEnabled\)/);
    expect(src).toMatch(/unlock-ios-paused-body/);
    expect(src).toMatch(/unlock-ios-manual/);
    expect(src).toMatch(/unlock-choose/);
    // Choose only in purchaseEnabled branch
    expect(src).toMatch(/if \(!purchaseEnabled \|\| busy\) return/);
  });

  it('paused copy is coherent (manual free, no dead Choose)', () => {
    expect(UNLOCK_AI_IOS_PAUSED_BODY).toMatch(/Manual logging stays free/i);
    expect(UNLOCK_AI_IOS_PAUSED_BODY).not.toMatch(/Choose|\$3\.99|Stripe/i);
  });

  it('default vitest Platform is ios → purchase disabled (matches TF binary)', async () => {
    const { Platform } = await import('react-native');
    expect(Platform.OS).toBe('ios');
    delete process.env.EXPO_PUBLIC_UNLOCK_AI_PURCHASE;
    expect(isUnlockAiPurchaseEnabled()).toBe(false);
  });
});

describe('Entitlements not corrupted by purchase hide', () => {
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
