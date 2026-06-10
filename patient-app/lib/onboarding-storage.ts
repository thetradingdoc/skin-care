import * as SecureStore from 'expo-secure-store';

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
  scan_summary?: string;
  positive_observations?: string[];
  fit_skin_tone?: string;
  fitzpatrick_estimate?: string;
  zone_polygons?: Record<string, number[][]>;
  reject_reason?: string;
  user_message?: string;
};

export async function getOnboardingDone(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_DONE_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setOnboardingDone(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, '1');
}

export async function getFaceRead(): Promise<FaceReadPayload | null> {
  try {
    const raw = await SecureStore.getItemAsync(ONBOARDING_FACE_READ_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FaceReadPayload;
  } catch {
    return null;
  }
}

export async function setFaceRead(payload: FaceReadPayload | null): Promise<void> {
  if (!payload) {
    await SecureStore.deleteItemAsync(ONBOARDING_FACE_READ_KEY);
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_FACE_READ_KEY, JSON.stringify(payload));
}

export async function getFacePhotoUri(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ONBOARDING_FACE_PHOTO_URI_KEY);
  } catch {
    return null;
  }
}

export async function setFacePhotoUri(uri: string | null): Promise<void> {
  if (!uri) {
    await SecureStore.deleteItemAsync(ONBOARDING_FACE_PHOTO_URI_KEY);
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_FACE_PHOTO_URI_KEY, uri);
}

export async function getConfirmedAge(): Promise<number | null> {
  try {
    const raw = await SecureStore.getItemAsync(ONBOARDING_CONFIRMED_AGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setConfirmedAge(age: number | null): Promise<void> {
  if (age == null) {
    await SecureStore.deleteItemAsync(ONBOARDING_CONFIRMED_AGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_CONFIRMED_AGE_KEY, String(Math.round(age)));
}

export async function getOnboardingConcernId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ONBOARDING_CONCERN_ID_KEY);
  } catch {
    return null;
  }
}

export async function setOnboardingConcernId(concernId: string): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_CONCERN_ID_KEY, concernId);
}

export async function getMatchJson(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await SecureStore.getItemAsync(ONBOARDING_MATCH_JSON_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function setMatchJson(match: Record<string, unknown> | null): Promise<void> {
  if (!match) {
    await SecureStore.deleteItemAsync(ONBOARDING_MATCH_JSON_KEY);
    return;
  }
  await SecureStore.setItemAsync(ONBOARDING_MATCH_JSON_KEY, JSON.stringify(match));
}

export async function setNeedsFirstPhoto(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_NEEDS_FIRST_PHOTO_KEY, '1');
}

export async function getNeedsFirstPhoto(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_NEEDS_FIRST_PHOTO_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function clearNeedsFirstPhoto(): Promise<void> {
  await SecureStore.deleteItemAsync(ONBOARDING_NEEDS_FIRST_PHOTO_KEY);
}

export async function setFirstPhotoLogged(): Promise<void> {
  await SecureStore.setItemAsync(FIRST_PHOTO_LOGGED_KEY, '1');
  await clearNeedsFirstPhoto();
}

export async function getFirstPhotoLogged(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(FIRST_PHOTO_LOGGED_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function clearOnboardingProgress(): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ONBOARDING_FACE_READ_KEY),
    SecureStore.deleteItemAsync(ONBOARDING_CONFIRMED_AGE_KEY),
    SecureStore.deleteItemAsync(ONBOARDING_CONCERN_ID_KEY),
    SecureStore.deleteItemAsync(ONBOARDING_MATCH_JSON_KEY),
    SecureStore.deleteItemAsync(ONBOARDING_NEEDS_FIRST_PHOTO_KEY),
  ]);
}
