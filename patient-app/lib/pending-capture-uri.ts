// PR1 soft-launch safety — 2026-07-12
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { sessionPersistDelete, sessionPersistGet, sessionPersistSet } from '@/lib/local-persist';

const SESSION_KEY = 'pending_capture_uri_v1';

type PendingCapture = {
  uri: string;
  mimeType?: string;
};

let pendingNative: PendingCapture | null = null;

function readWebPending(): PendingCapture | null {
  const raw = sessionPersistGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCapture;
    if (!parsed?.uri) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWebPending(value: PendingCapture | null): void {
  if (!value) {
    sessionPersistDelete(SESSION_KEY);
    return;
  }
  sessionPersistSet(SESSION_KEY, JSON.stringify(value));
}

/** Persist pending library-pick URI. Native: SecureStore + memory mirror. Web: sessionPersist (unchanged). */
export async function setPendingCaptureUri(uri: string, mimeType?: string): Promise<void> {
  const trimmed = String(uri || '').trim();
  if (!trimmed) return;
  const value: PendingCapture = { uri: trimmed, mimeType: mimeType || undefined };
  if (Platform.OS === 'web') {
    writeWebPending(value);
    return;
  }
  pendingNative = value;
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(value));
  } catch (e) {
    console.warn('[pending-capture-uri] SecureStore.set failed, in-memory only', e);
  }
}

export async function consumePendingCaptureUri(): Promise<PendingCapture | null> {
  if (Platform.OS === 'web') {
    const value = readWebPending();
    writeWebPending(null);
    return value;
  }
  try {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    if (stored) {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      pendingNative = null;
      try {
        const parsed = JSON.parse(stored) as PendingCapture;
        if (parsed?.uri) return parsed;
      } catch {
        /* fall through to memory */
      }
    }
  } catch (e) {
    console.warn('[pending-capture-uri] SecureStore.get failed, in-memory fallback', e);
  }
  const val = pendingNative;
  pendingNative = null;
  return val;
}

export async function peekPendingCaptureUri(): Promise<PendingCapture | null> {
  if (Platform.OS === 'web') return readWebPending();
  try {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PendingCapture;
        if (parsed?.uri) return parsed;
      } catch {
        /* fall through to memory */
      }
    }
  } catch (e) {
    console.warn('[pending-capture-uri] SecureStore.peek failed, in-memory fallback', e);
  }
  return pendingNative;
}

/** G-CANCEL — drop pending media without consuming into a new capture. */
export async function clearPendingCaptureUri(): Promise<void> {
  if (Platform.OS === 'web') {
    writeWebPending(null);
    return;
  }
  pendingNative = null;
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (e) {
    console.warn('[pending-capture-uri] SecureStore.clear failed', e);
  }
}
