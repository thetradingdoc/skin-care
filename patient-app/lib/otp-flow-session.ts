/**
 * SEC-32 — OTP flow email handoff without URL / navigation params.
 * Never stash the OTP code here (or in router params).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const EMAIL_KEY = 'touche_otp_flow_email';

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

export async function setOtpFlowEmail(email: string): Promise<void> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return;
  webSet(EMAIL_KEY, e);
  await AsyncStorage.setItem(EMAIL_KEY, e);
}

export async function getOtpFlowEmail(): Promise<string | null> {
  const raw = webGet(EMAIL_KEY) || (await AsyncStorage.getItem(EMAIL_KEY));
  const e = raw ? String(raw).trim() : '';
  return e || null;
}

export async function clearOtpFlowEmail(): Promise<void> {
  webRemove(EMAIL_KEY);
  await AsyncStorage.removeItem(EMAIL_KEY);
}
