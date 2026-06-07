import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getPatientSessionId } from '@/lib/patient-session';
import { SIGN_IN_HREF } from '@/constants/routes';

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
