import type { Href } from 'expo-router';

import {
  BIO_CALIBRATION_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TODAY_HREF,
} from '@/constants/routes';
import { fetchBioProfile } from '@/lib/conflict-api';
import { patientGet } from '@/lib/patient-api';

export type PostAuthRoute = Href;

/** Route after session is established (template + shelf + bio). */
export async function resolvePostAuthRoute(): Promise<PostAuthRoute> {
  try {
    const [template, shelf, bio] = await Promise.all([
      patientGet('/api/patient/routine/template'),
      patientGet('/api/patient/shelf/products').catch(() => ({ products: [] })),
      fetchBioProfile().catch(() => ({ profile_complete: true, conditions: [], prescriptions: [] })),
    ]);

    const products = Array.isArray(shelf?.products) ? shelf.products : [];
    const hasTemplate = Boolean(template?.has_template);
    const bioComplete = Boolean(bio?.profile_complete || (bio?.conditions?.length ?? 0) > 0);

    if (!hasTemplate) {
      return ROUTINE_PICK_HREF;
    }

    if (!bioComplete) {
      return BIO_CALIBRATION_HREF;
    }

    if (products.length === 0) {
      return SCAN_HREF;
    }

    return TODAY_HREF;
  } catch {
    return ROUTINE_PICK_HREF;
  }
}
