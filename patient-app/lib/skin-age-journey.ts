import { Platform } from 'react-native';

import { patchConsumerProfile } from '@/lib/consumer-profile-api';
import { setJourneyProfile } from '@/lib/journey-mode-storage';
import { patientPost } from '@/lib/patient-api';

const KEYS = {
  FACE_READ: 'sc_onboarding_face_read',
  CONFIRMED_AGE: 'sc_onboarding_confirmed_age',
  CONCERN_ID: 'sc_onboarding_concern_id',
  MATCH_JSON: 'sc_onboarding_match_json',
  QUICK_CHECK: 'sc_onboarding_quick_check',
} as const;

const DEFAULT_CONCERN = 'anti_aging';

function readSession(key: string): string | null {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeSession(key: string): void {
  if (Platform.OS !== 'web' || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function getFaceRead(): Record<string, unknown> | null {
  const raw = readSession(KEYS.FACE_READ);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getMatchJson(): Record<string, unknown> | null {
  const raw = readSession(KEYS.MATCH_JSON);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getQuickCheck(): Record<string, unknown> | null {
  const raw = readSession(KEYS.QUICK_CHECK);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function hasSkinAgeJourneyData(): boolean {
  return Boolean(readSession(KEYS.CONCERN_ID) || readSession(KEYS.FACE_READ));
}

export function clearSkinAgeJourney(): void {
  Object.values(KEYS).forEach((k) => removeSession(k));
  removeSession('sc_onboarding_suggested_concerns');
  removeSession('sc_onboarding_zone_breakdown');
  removeSession('sc_onboarding_quick_check_done');
}

export async function completeSkinAgeJourney(sessionId: string): Promise<boolean> {
  if (!sessionId || !hasSkinAgeJourneyData()) return false;

  const concernId = readSession(KEYS.CONCERN_ID) || DEFAULT_CONCERN;
  const faceRead = getFaceRead();
  const matchJson = getMatchJson();
  const quickCheck = getQuickCheck();
  const confirmedRaw = readSession(KEYS.CONFIRMED_AGE);
  const confirmedAge = confirmedRaw ? Number(confirmedRaw) : null;
  const hasBridgeData = Boolean(faceRead || matchJson || quickCheck);

  await patientPost('/api/patient/routine/template', { concern_id: concernId });

  if (hasBridgeData) {
    try {
      await patientPost('/api/patient/funnel/bridge', {
        concern_id: concernId,
        face_read: faceRead,
        match_result: matchJson,
        quick_check_answers: quickCheck,
        confirmed_age: Number.isFinite(confirmedAge) ? confirmedAge : undefined,
        user_goal: 'track_program',
      });
    } catch {
      /* bridge optional */
    }
  }

  const chosenAt = new Date().toISOString();
  await setJourneyProfile({
    modes: ['routine'],
    primary: 'routine',
    chosenAt,
  });
  try {
    await patchConsumerProfile({
      journey_modes: ['routine'],
      primary_mode: 'routine',
      chosen_at: chosenAt,
      bio_calibration_complete: hasBridgeData,
      onboarding_complete: true,
      needs_first_photo: true,
    });
  } catch {
    /* local journey profile still set */
  }

  clearSkinAgeJourney();
  return true;
}
