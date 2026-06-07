import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getPatientSessionId } from '@/lib/patient-session';

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
          router.replace('/sign-in');
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
