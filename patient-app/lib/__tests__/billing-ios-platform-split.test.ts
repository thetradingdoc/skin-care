/**
 * iOS platform split — Care / Plus: pricing UI only + Linking.openURL external checkout.
 * Asserts: no WebView / AuthSession / Elements on Steps 7–8–10; Step 9 reopens poll.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  CARE_EXTERNAL_CTA_PREFIX,
  mustUseExternalBrowserCheckout,
  PLUS_EXTERNAL_CTA,
} from '@/lib/billing-platform-checkout';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('mustUseExternalBrowserCheckout', () => {
  it('is true on iOS', () => {
    expect(mustUseExternalBrowserCheckout('ios')).toBe(true);
  });
  it('is false on web/android (unless EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT=1)', () => {
    const prev = process.env.EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT;
    delete process.env.EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT;
    expect(mustUseExternalBrowserCheckout('web')).toBe(false);
    expect(mustUseExternalBrowserCheckout('android')).toBe(false);
    if (prev === undefined) delete process.env.EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT;
    else process.env.EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT = prev;
  });
});

describe('Steps 7/8/10 — no in-app checkout chrome', () => {
  it('care-checkout uses openBillingCheckoutUrl / Linking — never WebBrowser AuthSession', () => {
    const src = readFileSync(join(APP, 'billing/care-checkout.tsx'), 'utf8');
    expect(src).toMatch(/openBillingCheckoutUrl/);
    expect(src).toMatch(/mustUseExternalBrowserCheckout/);
    expect(src).toMatch(/CARE_EXTERNAL_CTA_PREFIX/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
    expect(src).not.toMatch(/react-native-webview|<WebView\b|from ['\"]expo-web-browser['\"]/);
    expect(src).not.toMatch(/StripeProvider|CardField|PaymentSheet/);
  });

  it('unlock-ai shows pricing + external CTA on iOS path (not paused-hide-only)', () => {
    const src = readFileSync(join(APP, 'capture/unlock-ai.tsx'), 'utf8');
    expect(src).toMatch(/openBillingCheckoutUrl/);
    expect(src).toMatch(/mustUseExternalBrowserCheckout/);
    expect(src).toMatch(/PLUS_EXTERNAL_CTA/);
    expect(src).toMatch(/unlock-plus/);
    expect(src).toMatch(/unlock-pack-20/);
    expect(src).toMatch(/unlock-external-note/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
    expect(src).not.toMatch(/react-native-webview|<WebView\b|from ['\"]expo-web-browser['\"]/);
    // Old G-IAP full-hide early return removed from this screen
    expect(src).not.toMatch(/UNLOCK_AI_IOS_PAUSED_TITLE/);
    expect(src).not.toMatch(/isUnlockAiPurchaseEnabled/);
  });

  it('choose-plan has no checkout open — navigates only; iOS external note present', () => {
    const src = readFileSync(join(APP, 'billing/choose-plan.tsx'), 'utf8');
    expect(src).toMatch(/mustUseExternalBrowserCheckout/);
    expect(src).toMatch(/choose-plan-ios-external-note/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
    expect(src).not.toMatch(/openBillingCheckoutUrl/);
    expect(src).not.toMatch(/WebView/);
  });

  it('account care checkout also uses external openBillingCheckoutUrl', () => {
    const src = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(src).toMatch(/openBillingCheckoutUrl/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
  });

  it('CTA copy constants are external-browser framed', () => {
    expect(CARE_EXTERNAL_CTA_PREFIX).toMatch(/Continue in browser/i);
    expect(PLUS_EXTERNAL_CTA).toMatch(/Continue in browser/i);
  });
});

describe('Step 9 — app reopen subscription detect', () => {
  it('subscribed polls on focus and AppState active', () => {
    const src = readFileSync(join(APP, 'billing/subscribed.tsx'), 'utf8');
    expect(src).toMatch(/useFocusEffect/);
    expect(src).toMatch(/AppState\.addEventListener/);
    expect(src).toMatch(/\/api\/patient\/billing\/subscription/);
    expect(src).toMatch(/subscribed-reopen-note/);
    expect(src).not.toMatch(/openAuthSessionAsync/);
  });
});

describe('Repo search — no embedded checkout from billing steps', () => {
  it('no react-native-webview / stripe-react-native imports in billing+unlock sources', () => {
    const files = [
      'billing/choose-plan.tsx',
      'billing/care-checkout.tsx',
      'billing/subscribed.tsx',
      'capture/unlock-ai.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(join(APP, f), 'utf8');
      expect(src).not.toMatch(/react-native-webview|<WebView\b|@stripe\/stripe-react-native|from ['\"]expo-web-browser['\"]/);
    }
  });
});
