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

export function setPendingCaptureUri(uri: string, mimeType?: string): void {
  const trimmed = String(uri || '').trim();
  if (!trimmed) return;
  const value = { uri: trimmed, mimeType: mimeType || undefined };
  if (Platform.OS === 'web') {
    writeWebPending(value);
    return;
  }
  pendingNative = value;
}

export function consumePendingCaptureUri(): PendingCapture | null {
  if (Platform.OS === 'web') {
    const value = readWebPending();
    writeWebPending(null);
    return value;
  }
  const value = pendingNative;
  pendingNative = null;
  return value;
}

export function peekPendingCaptureUri(): PendingCapture | null {
  if (Platform.OS === 'web') return readWebPending();
  return pendingNative;
}
