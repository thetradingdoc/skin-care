import { Platform } from 'react-native';

import { patchConsumerProfile } from '@/lib/consumer-profile-api';
import {
  FUNNEL_SEGMENT,
  getFunnelSegment,
  getJourneyModesForSegment,
  type QuickCheckAnswers,
} from '@/lib/funnel-segment';
import { setJourneyProfile } from '@/lib/journey-mode-storage';
import { patientPost } from '@/lib/patient-api';

const KEYS = {
  FACE_READ: 'sc_onboarding_face_read',
  CONFIRMED_AGE: 'sc_onboarding_confirmed_age',
  CONCERN_ID: 'sc_onboarding_concern_id',
  MATCH_JSON: 'sc_onboarding_match_json',
  QUICK_CHECK: 'sc_onboarding_quick_check',
  JOURNEY_ID: 'sc_onboarding_journey_id',
  WATCH_ONLY: 'sc_onboarding_watch_only',
} as const;

const DEFAULT_CONCERN = 'barrier_repair';
const ROUTINE_DEFAULT_CONCERN = 'anti_aging';

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

function getQuickCheck(): QuickCheckAnswers | null {
  const raw = readSession(KEYS.QUICK_CHECK);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuickCheckAnswers;
  } catch {
    return null;
  }
}

function isWatchOnlyOnboarding(): boolean {
  return readSession(KEYS.WATCH_ONLY) === '1';
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

  const quickCheck = getQuickCheck();
  const watchOnly = isWatchOnlyOnboarding();
  const segment = getFunnelSegment(quickCheck, watchOnly);
  const { modes, primary } = getJourneyModesForSegment(segment);
  const routinePath = segment === FUNNEL_SEGMENT.ROUTINE_READY;

  const concernId =
    readSession(KEYS.CONCERN_ID) ||
    (routinePath ? ROUTINE_DEFAULT_CONCERN : DEFAULT_CONCERN);
  const faceRead = getFaceRead();
  const matchJson = getMatchJson();
  const confirmedRaw = readSession(KEYS.CONFIRMED_AGE);
  const confirmedAge = confirmedRaw ? Number(confirmedRaw) : null;
  const hasBridgeData = Boolean(faceRead || matchJson || quickCheck);
  const journeyId = readSession(KEYS.JOURNEY_ID);
  const userGoal = routinePath ? 'track_program' : 'track_journal';

  if (routinePath) {
    await patientPost('/api/patient/routine/template', { concern_id: concernId });
  }

  if (hasBridgeData || journeyId) {
    try {
      await patientPost('/api/patient/funnel/bridge', {
        concern_id: concernId,
        journey_id: journeyId || undefined,
        face_read: faceRead,
        match_result: matchJson,
        quick_check_answers: quickCheck,
        confirmed_age: Number.isFinite(confirmedAge) ? confirmedAge : undefined,
        user_goal: userGoal,
        journey_modes: modes,
        primary_mode: primary,
      });
    } catch {
      /* bridge optional */
    }
  }

  const chosenAt = new Date().toISOString();
  await setJourneyProfile({
    modes,
    primary,
    chosenAt,
  });
  try {
    await patchConsumerProfile({
      journey_modes: modes,
      primary_mode: primary,
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
