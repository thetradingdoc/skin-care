import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { SIGN_IN_HREF } from '@/constants/routes';
import { patientGet } from '@/lib/patient-api';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import { clearPatientSession, getPatientSessionId } from '@/lib/patient-session';

/**
 * Redirects to /sign-in when no patient session is stored.
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
          if (isPatientSessionAuthError(401, msg)) {
            await clearPatientSession();
            router.replace(SIGN_IN_HREF);
            return;
          }
          throw e;
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
