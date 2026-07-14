// PR1 soft-launch safety — 2026-07-12
import type { Href } from 'expo-router';

import { SIGN_IN_HREF, TRY_VERDICT_HREF } from '@/constants/routes';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import { patientGet } from '@/lib/patient-api';
import { clearPatientSession, getPatientSessionId } from '@/lib/patient-session';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';

export type InitialRoute = Href;

export { resolvePostAuthRoute };
export { BIO_CALIBRATION_HREF, JOURNEY_CHOOSE_HREF } from '@/constants/routes';

/** Soft-launch: keep session on flaky network; only clear on real auth failure. */
export const SIGN_IN_CONNECTION_HREF = '/sign-in?error=connection' as Href;

/** Cold start — validates session server-side when stored locally. */
export async function resolveInitialRoute(): Promise<InitialRoute> {
  const sessionId = await getPatientSessionId();
  if (!sessionId) {
    // TOUCH-013: fresh load → try-verdict, not face-age funnel / bare sign-in.
    return TRY_VERDICT_HREF;
  }
  try {
    await patientGet('/api/patient/me');
    return resolvePostAuthRoute();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    // Pass status 0 so we detect auth from message only (do NOT hardcode 401 —
    // isPatientSessionAuthError(401, …) always returns true).
    if (isPatientSessionAuthError(0, msg)) {
      await clearPatientSession();
      return SIGN_IN_HREF;
    }
    // PR1-16: non-401 / network — keep session, show connection error on sign-in
    return SIGN_IN_CONNECTION_HREF;
  }
}
