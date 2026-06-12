import { persistGet, persistSet } from '@/lib/local-persist';
import {
  consumerProfileToJourney,
  fetchConsumerProfile,
  patchConsumerProfile,
} from '@/lib/consumer-profile-api';

export type JourneyMode = 'watch' | 'routine';

export type JourneyProfile = {
  modes: JourneyMode[];
  primary: JourneyMode;
  chosenAt: string;
};

const KEY = 'patient_journey_profile_v1';

async function readLocalProfile(): Promise<JourneyProfile | null> {
  try {
    const raw = await persistGet(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JourneyProfile;
    if (!Array.isArray(parsed.modes) || !parsed.primary) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeLocalProfile(profile: JourneyProfile): Promise<void> {
  await persistSet(KEY, JSON.stringify(profile));
}

/** Server-first: API profile wins when journey_modes are set; local is cache fallback. */
export async function getJourneyProfile(): Promise<JourneyProfile | null> {
  const server = consumerProfileToJourney(await fetchConsumerProfile());
  if (server?.modes?.length) {
    await writeLocalProfile(server);
    return server;
  }
  return readLocalProfile();
}

export async function setJourneyProfile(profile: JourneyProfile): Promise<boolean> {
  await writeLocalProfile(profile);
  const server = await patchConsumerProfile({
    journey_modes: profile.modes,
    primary_mode: profile.primary,
    chosen_at: profile.chosenAt,
  });
  return server != null;
}

export async function hasJourneyMode(): Promise<boolean> {
  const p = await getJourneyProfile();
  return Boolean(p?.modes?.length);
}

export async function hasRoutineMode(): Promise<boolean> {
  const p = await getJourneyProfile();
  return Boolean(p?.modes?.includes('routine'));
}

export async function hasWatchMode(): Promise<boolean> {
  const p = await getJourneyProfile();
  return Boolean(p?.modes?.includes('watch'));
}

export async function toggleJourneyMode(mode: JourneyMode, enabled: boolean): Promise<JourneyProfile> {
  const existing = (await getJourneyProfile()) ?? {
    modes: [] as JourneyMode[],
    primary: mode,
    chosenAt: new Date().toISOString(),
  };
  const modes = new Set(existing.modes);
  if (enabled) modes.add(mode);
  else modes.delete(mode);
  const nextModes = Array.from(modes);
  const primary =
    nextModes.includes(existing.primary) ? existing.primary : nextModes[0] ?? mode;
  const profile: JourneyProfile = {
    modes: nextModes,
    primary,
    chosenAt: existing.chosenAt,
  };
  await setJourneyProfile(profile);
  return profile;
}

/** Sync onboarding flags to server consumer profile. */
export async function syncOnboardingFlags(flags: {
  onboarding_complete?: boolean;
  needs_first_photo?: boolean;
  bio_calibration_complete?: boolean;
}): Promise<void> {
  await patchConsumerProfile(flags);
}
