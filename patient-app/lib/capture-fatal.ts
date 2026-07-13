/**
 * Capture fatal JS exceptions before RCTFatal aborts.
 * Sync HTTPS POST so the payload can leave the device before abort().
 *
 * IMPORTANT: only fatals are posted (sync XHR on every warning would stall cold start).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/config';

const INGEST_PATH = '/api/patient/public/client-fatal';

let installed = false;

function ingestUrl(): string {
  const override = process.env.EXPO_PUBLIC_FATAL_INGEST_URL?.trim();
  if (override) return override.replace(/\/$/, '');
  return `${API_BASE_URL.replace(/\/$/, '')}${INGEST_PATH}`;
}

function syncPostFatal(payload: Record<string, unknown>) {
  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', ingestUrl(), false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.send(JSON.stringify(payload));
  } catch {
    /* best effort before abort */
  }
}

export function installCaptureFatal() {
  if (installed) return;
  installed = true;

  const g = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ((e: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (handler: (e: Error, isFatal?: boolean) => void) => void;
    };
  };

  const ErrorUtils = g.ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;

  const prev = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      const message = error?.message || String(error);
      const stack = error?.stack || '';
      const expoConfig = Constants.expoConfig;
      syncPostFatal({
        isFatal: true,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: String(expoConfig?.version || ''),
        build: String(
          (expoConfig as { ios?: { buildNumber?: string } } | null)?.ios?.buildNumber ||
            Constants.nativeBuildVersion ||
            '',
        ),
        errorMessage: message.slice(0, 800),
        stack: stack.slice(0, 2500),
        at: Date.now(),
      });
    }
    prev?.(error, isFatal);
  });
}

installCaptureFatal();
