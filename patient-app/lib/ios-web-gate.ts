/**
 * TOUCH-027 — iOS web vs Android/desktop detection for Screen 6c gate.
 */
import { Platform } from 'react-native';

export function getUserAgentString(ua?: string): string {
  if (ua) return ua;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.userAgent || '';
  }
  return '';
}

/**
 * True only for iOS Safari / WebKit on iPhone or iPad (incl. iPadOS desktop UA).
 * Android and desktop (non-iPad) are excluded.
 */
export function isIosWebClient(ua?: string): boolean {
  if (Platform.OS !== 'web') return false;
  const s = getUserAgentString(ua);
  if (!s) return false;
  const lower = s.toLowerCase();
  const isIphone = /iphone/.test(lower);
  const isIpad = /ipad/.test(lower) || (/macintosh/.test(lower) && navigatorMaxTouchPoints() > 1);
  if (!isIphone && !isIpad) return false;
  // Require Apple WebKit path (exclude weird Android UAs spoofing iPhone without WebKit).
  return /applewebkit/.test(lower);
}

function navigatorMaxTouchPoints(): number {
  if (typeof navigator === 'undefined') return 0;
  return Number(navigator.maxTouchPoints) || 0;
}

/** Convenience: show Get-the-App interstitial only on iOS web after OTP. */
export function shouldShowGetTheAppInterstitial(ua?: string): boolean {
  return isIosWebClient(ua);
}
