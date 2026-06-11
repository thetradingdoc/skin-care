import type { Href } from 'expo-router';

import { getPatientSessionId } from '@/lib/patient-session';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';
import { SIGN_IN_HREF, BIO_CALIBRATION_HREF } from '@/constants/routes';

export type InitialRoute = Href;

export { BIO_CALIBRATION_HREF, resolvePostAuthRoute };

/** Cold start — includes sign-in gate when no session. */
export async function resolveInitialRoute(): Promise<InitialRoute> {
  const sessionId = await getPatientSessionId();
  if (sessionId) {
    return resolvePostAuthRoute();
  }
  return SIGN_IN_HREF;
}
