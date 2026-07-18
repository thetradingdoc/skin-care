/**
 * P2.23 — Stash server capture_token through onboarding → OTP verify.
 * Distinct from pending-capture-uri (local photo URI) and TOUCH-026 product JSON.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_KEY = 'touche_pending_capture_token';

function webGet(key: string): string | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSet(key: string, value: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function webRemove(key: string) {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export async function setPendingCaptureToken(token: string): Promise<void> {
  const t = String(token || '').trim();
  if (!t) return;
  webSet(TOKEN_KEY, t);
  await AsyncStorage.setItem(TOKEN_KEY, t);
}

export async function getPendingCaptureToken(): Promise<string | null> {
  const raw = webGet(TOKEN_KEY) || (await AsyncStorage.getItem(TOKEN_KEY));
  const t = raw ? String(raw).trim() : '';
  return t || null;
}

export async function clearPendingCaptureToken(): Promise<void> {
  webRemove(TOKEN_KEY);
  await AsyncStorage.removeItem(TOKEN_KEY);
}
