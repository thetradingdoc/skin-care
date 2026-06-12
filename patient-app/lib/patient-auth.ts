import { Platform } from 'react-native';

import { SIGN_IN_HREF } from '@/constants/routes';
import { clearPatientSession } from '@/lib/patient-session';

export function isPatientSessionAuthError(status: number, error?: unknown): boolean {
  if (status === 401) return true;
  const msg = String(error ?? '').toLowerCase();
  return (
    msg.includes('invalid or expired session') ||
    msg.includes('x-session-id required') ||
    msg.includes('sign in required')
  );
}

type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;
let clearingSession = false;

/** Register navigation when API returns 401 (call from root layout). */
export function registerSessionExpiredHandler(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null;
  };
}

/** Clear stale session and send user back to sign-in. */
export async function handleExpiredPatientSession(): Promise<void> {
  if (clearingSession) return;
  clearingSession = true;
  try {
    await clearPatientSession();
    sessionExpiredHandler?.();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const path = window.location.pathname || '';
      if (!path.includes('/sign-in')) {
        window.location.assign('/app/sign-in');
      }
    }
  } finally {
    clearingSession = false;
  }
}

export { SIGN_IN_HREF };
