// PR1 soft-launch safety — 2026-07-12
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { SIGN_IN_HREF } from '@/constants/routes';
import { SIGN_IN_CONNECTION_HREF } from '@/hooks/useOnboardingGate';
import { patientGet } from '@/lib/patient-api';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import { clearPatientSession, getPatientSessionId } from '@/lib/patient-session';

/**
 * Redirects to /sign-in when no patient session is stored.
 * Non-auth /me failures keep the session and route to connection error (PR1 soft-launch).
 */
export function useRequirePatientSession() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const sid = await getPatientSessionId();
        if (cancelled) return;
        if (!sid) {
          router.replace(SIGN_IN_HREF);
          return;
        }
        try {
          await patientGet('/api/patient/me');
        } catch (e: unknown) {
          if (cancelled) return;
          const msg = e instanceof Error ? e.message : '';
          // Message-only auth check (do not hardcode 401 — that always returns true)
          if (isPatientSessionAuthError(0, msg)) {
            await clearPatientSession();
            router.replace(SIGN_IN_HREF);
            return;
          }
          // Soft-launch: keep session on flaky network / non-auth API failure
          router.replace(SIGN_IN_CONNECTION_HREF);
          return;
        }
        if (cancelled) return;
        setReady(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { ready, checking };
}
