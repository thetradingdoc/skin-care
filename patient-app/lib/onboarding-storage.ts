import { persistDelete, persistGet, persistSet } from '@/lib/local-persist';

export const ONBOARDING_FACE_READ_KEY = 'onboarding_face_read';
export const ONBOARDING_FACE_PHOTO_URI_KEY = 'onboarding_face_photo_uri';
export const ONBOARDING_CONFIRMED_AGE_KEY = 'onboarding_confirmed_age';
export const ONBOARDING_CONCERN_ID_KEY = 'onboarding_concern_id';
export const ONBOARDING_MATCH_JSON_KEY = 'onboarding_match_json';
export const ONBOARDING_DONE_KEY = 'onboarding_done';
export const ONBOARDING_NEEDS_FIRST_PHOTO_KEY = 'onboarding_needs_first_photo';
export const FIRST_PHOTO_LOGGED_KEY = 'first_photo_logged';

export type FaceFinding = {
  id?: string;
  label?: string;
  plain_language?: string;
  detail?: string;
  severity?: number;
  zones?: string[];
  confidence?: number;
};

export type FaceReadPayload = {
  apparent_age_estimate?: number;
  quality?: string;
  model_id?: string;
  model_version?: string;
  vision_enabled?: boolean;
  vision_error?: string | null;
  findings?: FaceFinding[];
  concern_scores?: Record<string, number>;
  health_scores?: Record<string, number | null>;
  age_unreliable?: boolean;
  scan_summary?: string;
  positive_observations?: string[];
  fit_skin_tone?: string;
  fitzpatrick_estimate?: string;
  zone_polygons?: Record<string, number[][]>;
  reject_reason?: string;
  user_message?: string;
};

export async function getOnboardingDone(): Promise<boolean> {
  return (await persistGet(ONBOARDING_DONE_KEY)) === '1';
}

export async function setOnboardingDone(): Promise<void> {
  await persistSet(ONBOARDING_DONE_KEY, '1');
}

export async function getFaceRead(): Promise<FaceReadPayload | null> {
  const raw = await persistGet(ONBOARDING_FACE_READ_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FaceReadPayload;
  } catch {
    return null;
  }
}

export async function setFaceRead(payload: FaceReadPayload | null): Promise<void> {
  if (!payload) {
    await persistDelete(ONBOARDING_FACE_READ_KEY);
    return;
  }
  await persistSet(ONBOARDING_FACE_READ_KEY, JSON.stringify(payload));
}

export async function getFacePhotoUri(): Promise<string | null> {
  return persistGet(ONBOARDING_FACE_PHOTO_URI_KEY);
}

export async function setFacePhotoUri(uri: string | null): Promise<void> {
  if (!uri) {
    await persistDelete(ONBOARDING_FACE_PHOTO_URI_KEY);
    return;
  }
  await persistSet(ONBOARDING_FACE_PHOTO_URI_KEY, uri);
}

export async function getConfirmedAge(): Promise<number | null> {
  const raw = await persistGet(ONBOARDING_CONFIRMED_AGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function setConfirmedAge(age: number | null): Promise<void> {
  if (age == null) {
    await persistDelete(ONBOARDING_CONFIRMED_AGE_KEY);
    return;
  }
  await persistSet(ONBOARDING_CONFIRMED_AGE_KEY, String(Math.round(age)));
}

export async function getOnboardingConcernId(): Promise<string | null> {
  return persistGet(ONBOARDING_CONCERN_ID_KEY);
}

export async function setOnboardingConcernId(concernId: string): Promise<void> {
  await persistSet(ONBOARDING_CONCERN_ID_KEY, concernId);
}

export async function getMatchJson(): Promise<Record<string, unknown> | null> {
  const raw = await persistGet(ONBOARDING_MATCH_JSON_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function setMatchJson(match: Record<string, unknown> | null): Promise<void> {
  if (!match) {
    await persistDelete(ONBOARDING_MATCH_JSON_KEY);
    return;
  }
  await persistSet(ONBOARDING_MATCH_JSON_KEY, JSON.stringify(match));
}

export async function setNeedsFirstPhoto(): Promise<void> {
  await persistSet(ONBOARDING_NEEDS_FIRST_PHOTO_KEY, '1');
}

export async function getNeedsFirstPhoto(): Promise<boolean> {
  return (await persistGet(ONBOARDING_NEEDS_FIRST_PHOTO_KEY)) === '1';
}

export async function clearNeedsFirstPhoto(): Promise<void> {
  await persistDelete(ONBOARDING_NEEDS_FIRST_PHOTO_KEY);
}

export async function setFirstPhotoLogged(): Promise<void> {
  await persistSet(FIRST_PHOTO_LOGGED_KEY, '1');
  await clearNeedsFirstPhoto();
}

export async function getFirstPhotoLogged(): Promise<boolean> {
  return (await persistGet(FIRST_PHOTO_LOGGED_KEY)) === '1';
}

export async function clearOnboardingProgress(): Promise<void> {
  await Promise.allSettled([
    persistDelete(ONBOARDING_FACE_READ_KEY),
    persistDelete(ONBOARDING_CONFIRMED_AGE_KEY),
    persistDelete(ONBOARDING_CONCERN_ID_KEY),
    persistDelete(ONBOARDING_MATCH_JSON_KEY),
    persistDelete(ONBOARDING_NEEDS_FIRST_PHOTO_KEY),
  ]);
}
