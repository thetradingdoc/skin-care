import { saveBioProfile } from '@/lib/conflict-api';
import { syncOnboardingFlags } from '@/lib/journey-mode-storage';
import { patientPost } from '@/lib/patient-api';
import {
  getFaceRead,
  getMatchJson,
  getOnboardingConcernId,
  setNeedsFirstPhoto,
  setOnboardingDone,
} from '@/lib/onboarding-storage';

const CONCERN_TO_CONDITION: Record<string, string> = {
  acne: 'acne',
  rosacea: 'rosacea',
  hyperpigmentation: 'hyperpigmentation',
  hyperpigmentation_dark_skin: 'dark_marks',
  barrier_repair: 'barrier_compromised',
  anti_aging: 'none',
};

export async function completeOnboardingAfterSignup(): Promise<void> {
  const concernId = (await getOnboardingConcernId()) || 'anti_aging';
  const faceRead = await getFaceRead();
  const matchJson = await getMatchJson();

  await patientPost('/api/patient/routine/template', { concern_id: concernId });

  if (faceRead || matchJson) {
    try {
      await patientPost('/api/patient/funnel/bridge', {
        concern_id: concernId,
        face_read: faceRead,
        match_result: matchJson,
        user_goal: 'track_program',
      });
    } catch {
      // bridge is optional for v1
    }
  }

  const mappedCondition = CONCERN_TO_CONDITION[concernId];
  if (mappedCondition && mappedCondition !== 'none') {
    try {
      await saveBioProfile({
        conditions: [mappedCondition],
        prescriptions: [],
        profile_complete: true,
      });
    } catch {
      // native path still works if bridge populated bio
    }
  }

  await setOnboardingDone();
  await setNeedsFirstPhoto();
  try {
    await syncOnboardingFlags({
      onboarding_complete: true,
      needs_first_photo: true,
      bio_calibration_complete: mappedCondition != null && mappedCondition !== 'none',
    });
  } catch {
    // server sync optional when offline
  }
}
