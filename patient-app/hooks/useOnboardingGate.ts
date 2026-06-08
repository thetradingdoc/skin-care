import type { Href } from 'expo-router';

import { getPatientSessionId } from '@/lib/patient-session';
import { patientGet } from '@/lib/patient-api';
import { ROUTINE_PICK_HREF, SIGN_IN_HREF, TODAY_HREF } from '@/constants/routes';

export type InitialRoute = Href;

/** Returning users only — new users complete signup on the web landing funnel. */
export async function resolveInitialRoute(): Promise<InitialRoute> {
  const sessionId = await getPatientSessionId();

  if (sessionId) {
    try {
      const template = await patientGet('/api/patient/routine/template');
      if (template?.has_template) {
        return TODAY_HREF;
      }
    } catch {
      // fall through
    }
    return ROUTINE_PICK_HREF;
  }

  return SIGN_IN_HREF;
}
