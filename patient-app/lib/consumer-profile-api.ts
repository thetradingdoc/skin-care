import { patientGet, patientPatch } from '@/lib/patient-api';
import type { JourneyMode, JourneyProfile } from '@/lib/journey-mode-storage';

export type ConsumerProfile = {
  journey_modes: JourneyMode[];
  primary_mode: JourneyMode | null;
  onboarding_complete: boolean;
  bio_calibration_complete: boolean;
  needs_first_photo: boolean;
  chosen_at: string | null;
};

export async function fetchConsumerProfile(): Promise<ConsumerProfile | null> {
  try {
    const data = await patientGet('/api/patient/consumer-profile');
    const p = data?.profile;
    if (!p) return null;
    const modes = (p.journey_modes ?? p.modes ?? []) as JourneyMode[];
    return {
      journey_modes: Array.isArray(modes) ? modes : [],
      primary_mode: (p.primary_mode ?? p.primary ?? null) as JourneyMode | null,
      onboarding_complete: Boolean(p.onboarding_complete),
      bio_calibration_complete: Boolean(p.bio_calibration_complete),
      needs_first_photo: Boolean(p.needs_first_photo),
      chosen_at: p.chosen_at ?? p.chosenAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function patchConsumerProfile(
  patch: Partial<ConsumerProfile> & { journey_modes?: JourneyMode[]; primary?: JourneyMode },
): Promise<ConsumerProfile | null> {
  const data = await patientPatch('/api/patient/consumer-profile', {
    journey_modes: patch.journey_modes,
    primary_mode: patch.primary_mode ?? patch.primary,
    onboarding_complete: patch.onboarding_complete,
    bio_calibration_complete: patch.bio_calibration_complete,
    needs_first_photo: patch.needs_first_photo,
    chosen_at: patch.chosen_at,
  });
  const profile = fetchConsumerProfileFromPayload(data?.profile);
  if (!profile) throw new Error('consumer_profile_patch_failed');
  return profile;
}

function fetchConsumerProfileFromPayload(p: Record<string, unknown> | null | undefined): ConsumerProfile | null {
  if (!p) return null;
  const modes = (p.journey_modes ?? p.modes ?? []) as JourneyMode[];
  return {
    journey_modes: Array.isArray(modes) ? modes : [],
    primary_mode: (p.primary_mode ?? p.primary ?? null) as JourneyMode | null,
    onboarding_complete: Boolean(p.onboarding_complete),
    bio_calibration_complete: Boolean(p.bio_calibration_complete),
    needs_first_photo: Boolean(p.needs_first_photo),
    chosen_at: (p.chosen_at ?? p.chosenAt ?? null) as string | null,
  };
}

export function consumerProfileToJourney(profile: ConsumerProfile | null): JourneyProfile | null {
  if (!profile?.journey_modes?.length) return null;
  return {
    modes: profile.journey_modes,
    primary: profile.primary_mode ?? profile.journey_modes[0],
    chosenAt: profile.chosen_at ?? new Date().toISOString(),
  };
}
