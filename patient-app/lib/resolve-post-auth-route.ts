import type { Href } from 'expo-router';

import {
  BIO_CALIBRATION_HREF,
  HOME_HREF,
  JOURNEY_CHOOSE_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TRACK_HREF,
} from '@/constants/routes';
import { fetchBioProfile } from '@/lib/conflict-api';
import { fetchConsumerProfile } from '@/lib/consumer-profile-api';
import { getJourneyProfile, type JourneyMode } from '@/lib/journey-mode-storage';
import { listSpots } from '@/lib/spot-store';
import { patientGet } from '@/lib/patient-api';

export type PostAuthRoute = Href;

export type PostAuthRouteHints = {
  /** Freshly saved modes before server PATCH propagates (journey-choose). */
  journeyModes?: JourneyMode[];
};

function resolveJourneyModes(
  serverModes: JourneyMode[] | undefined,
  localModes: JourneyMode[] | undefined,
  hints?: PostAuthRouteHints,
): JourneyMode[] {
  if (serverModes?.length) return serverModes;
  if (hints?.journeyModes?.length) return hints.journeyModes;
  if (localModes?.length) return localModes;
  return [];
}

async function resolveWithModes(modes: JourneyMode[]): Promise<PostAuthRoute> {
  const routineMode = modes.includes('routine');
  const watchMode = modes.includes('watch');
  const spotMode = modes.includes('spot');
  const serverProfile = await fetchConsumerProfile().catch(() => null);

  const [spots, template, shelf, bio] = await Promise.all([
    listSpots().catch(() => []),
    patientGet('/api/patient/routine/template').catch(() => ({ has_template: false })),
    patientGet('/api/patient/shelf/products').catch(() => ({ products: [] })),
    fetchBioProfile().catch(() => ({ profile_complete: false, conditions: [], prescriptions: [] })),
  ]);

  if (spotMode && !watchMode && !routineMode) {
    return TRACK_HREF;
  }

  if (watchMode && !routineMode) {
    return HOME_HREF;
  }

  const products = Array.isArray(shelf?.products) ? shelf.products : [];
  const hasTemplate = Boolean(template?.has_template);
  const bioComplete = Boolean(
    serverProfile?.bio_calibration_complete ||
      bio?.profile_complete ||
      (bio?.conditions?.length ?? 0) > 0,
  );

  if (routineMode && !hasTemplate) {
    return ROUTINE_PICK_HREF;
  }

  if (routineMode && !bioComplete) {
    return BIO_CALIBRATION_HREF;
  }

  if (routineMode && products.length === 0) {
    return SCAN_HREF;
  }

  if (spotMode && watchMode && spots.length === 0 && !hasTemplate) {
    return TRACK_HREF;
  }

  return HOME_HREF;
}

/** Route after session is established (journey + template + shelf + bio). */
export async function resolvePostAuthRoute(hints?: PostAuthRouteHints): Promise<PostAuthRoute> {
  try {
    const [serverProfile, journeyProfile] = await Promise.all([
      fetchConsumerProfile(),
      getJourneyProfile(),
    ]);

    const modes = resolveJourneyModes(
      serverProfile?.journey_modes,
      journeyProfile?.modes,
      hints,
    );

    if (!modes.length) {
      return JOURNEY_CHOOSE_HREF;
    }

    return resolveWithModes(modes);
  } catch {
    const local = await getJourneyProfile().catch(() => null);
    if (local?.modes?.length) {
      try {
        return await resolveWithModes(local.modes);
      } catch {
        return HOME_HREF;
      }
    }
    return HOME_HREF;
  }
}
