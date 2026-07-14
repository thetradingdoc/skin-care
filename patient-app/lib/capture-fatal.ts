/**
 * Secondary ErrorUtils capture (boot hook is primary: lib/capture-fatal-boot.js).
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
    /* best effort */
  }
}

function tryInstallOnce(): boolean {
  const g = globalThis as typeof globalThis & {
    ErrorUtils?: {
      getGlobalHandler?: () => ((e: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (handler: (e: Error, isFatal?: boolean) => void) => void;
      __skincareWrapped?: boolean;
    };
    __SKINCARE_LAST_FATAL__?: { message: string; stack: string; at: number };
  };

  const ErrorUtils = g.ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler || ErrorUtils.__skincareWrapped) return !!ErrorUtils?.__skincareWrapped;

  const prev = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) {
      const message = error?.message || String(error);
      const stack = error?.stack || '';
      g.__SKINCARE_LAST_FATAL__ = { message, stack, at: Date.now() };
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
    // Never swallow — silent swallow left a black empty root on device.
    prev?.(error, isFatal);
  });
  ErrorUtils.__skincareWrapped = true;
  return true;
}

export function installCaptureFatal() {
  if (installed) return;
  if (!tryInstallOnce()) {
    let attempts = 0;
    const t = setInterval(() => {
      attempts += 1;
      if (installed || attempts > 40) {
        clearInterval(t);
        return;
      }
      if (tryInstallOnce()) {
        installed = true;
        clearInterval(t);
      }
    }, 50);
    return;
  }
  installed = true;
}

installCaptureFatal();
