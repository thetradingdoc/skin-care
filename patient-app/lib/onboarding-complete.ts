import { patientPost } from '@/lib/patient-api';
import {
  getFaceRead,
  getMatchJson,
  getOnboardingConcernId,
  setNeedsFirstPhoto,
  setOnboardingDone,
} from '@/lib/onboarding-storage';

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

  await setOnboardingDone();
  await setNeedsFirstPhoto();
}
