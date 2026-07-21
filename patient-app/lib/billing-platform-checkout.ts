/**
 * Billing Care / Plus checkout open path (App Store platform split).
 *
 * iOS: never open checkout inside the app (no WebView, Stripe Elements,
 * or expo-web-browser AuthSession / SFSafariViewController). Pricing screens
 * stay native; the CTA opens the Stripe Checkout URL in the external browser
 * via Linking.openURL. Subscription truth is verified on app reopen
 * (GET /billing/subscription), not via an in-app return WebView.
 *
 * Web / Android: same Linking.openURL path for Care/Plus (no embedded checkout).
 */
import { Linking, Platform } from 'react-native';

/** True when this OS must not render or host in-app checkout chrome. */
export function mustUseExternalBrowserCheckout(os: string = Platform.OS): boolean {
  // Evidence/dev override so web Playwright can screenshot the iOS CTA copy.
  if (String(process.env.EXPO_PUBLIC_FORCE_EXTERNAL_CHECKOUT || '').trim() === '1') return true;
  return os === 'ios';
}

/**
 * Open a Stripe Checkout (or equivalent) URL outside the app shell.
 * Never uses WebBrowser.openAuthSessionAsync / openBrowserAsync / WebView.
 */
export async function openBillingCheckoutUrl(url: string): Promise<void> {
  const trimmed = String(url || '').trim();
  if (!trimmed) throw new Error('Checkout URL missing');
  const supported = await Linking.canOpenURL(trimmed);
  if (!supported) throw new Error('Checkout link could not be opened.');
  await Linking.openURL(trimmed);
}

export const CARE_EXTERNAL_CTA_PREFIX = 'Continue in browser';
export const PLUS_EXTERNAL_CTA = 'Continue in browser';
