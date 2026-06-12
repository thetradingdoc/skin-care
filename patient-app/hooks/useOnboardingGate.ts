import type { Href } from 'expo-router';

import { SIGN_IN_HREF } from '@/constants/routes';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import { patientGet } from '@/lib/patient-api';
import { clearPatientSession, getPatientSessionId } from '@/lib/patient-session';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';

export type InitialRoute = Href;

export { resolvePostAuthRoute };
export { BIO_CALIBRATION_HREF, JOURNEY_CHOOSE_HREF } from '@/constants/routes';

/** Cold start — validates session server-side when stored locally. */
export async function resolveInitialRoute(): Promise<InitialRoute> {
  const sessionId = await getPatientSessionId();
  if (!sessionId) {
    return SIGN_IN_HREF;
  }
  try {
    await patientGet('/api/patient/me');
    return resolvePostAuthRoute();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (isPatientSessionAuthError(401, msg)) {
      await clearPatientSession();
      return SIGN_IN_HREF;
    }
    return resolvePostAuthRoute();
  }
}
