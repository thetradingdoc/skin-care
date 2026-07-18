'use strict';

/**
 * P5.05 / P7.03 — Post-auth routing.
 * Authenticated cold lander is always Progress. journey_modes never gate elsewhere.
 * Spot-only empty → Track was a silent cold-lander regression; removed in P7.03.
 */

import type { Href } from 'expo-router';

import { CAPTURE_2A_HREF, PROGRESS_HREF } from '@/constants/routes';
import type { JourneyMode } from '@/lib/journey-mode-storage';
import { getJourneyProfile } from '@/lib/journey-mode-storage';
import { fetchConsumerProfile } from '@/lib/consumer-profile-api';

export type PostAuthRoute = Href;

export type PostAuthRouteHints = {
  journeyModes?: JourneyMode[];
  /**
   * Cold lander always uses Progress (P7.03).
   * preferProgress:false is only for an explicit in-app capture jump — never cold auth.
   */
  preferProgress?: boolean;
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

/**
 * Pure resolver used by tests — no network.
 * P7.03: every journey_modes combo cold-lands on Progress (not Check, Track, journey-choose).
 */
export function resolvePostAuthRouteSync(
  _modes: JourneyMode[],
  opts: { preferProgress?: boolean } = {},
): PostAuthRoute {
  const preferProgress = opts.preferProgress !== false;
  return preferProgress ? PROGRESS_HREF : CAPTURE_2A_HREF;
}

/** Route after session is established (cold auth / OTP / handoff). */
export async function resolvePostAuthRoute(hints?: PostAuthRouteHints): Promise<PostAuthRoute> {
  try {
    const [serverProfile, journeyProfile] = await Promise.all([
      fetchConsumerProfile().catch(() => null),
      getJourneyProfile().catch(() => null),
    ]);

    const modes = resolveJourneyModes(
      serverProfile?.journey_modes,
      journeyProfile?.modes,
      hints,
    );

    return resolvePostAuthRouteSync(modes, {
      preferProgress: hints?.preferProgress,
    });
  } catch {
    return PROGRESS_HREF;
  }
}
