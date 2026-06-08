import { API_BASE_URL } from '@/config';
import type { FaceReadPayload } from '@/lib/onboarding-storage';

const MOCK_RESULT: FaceReadPayload = {
  apparent_age_estimate: 31,
  quality: 'ok',
  model_id: 'mock',
  model_version: 'dev',
};

function useMockFaceRead(): boolean {
  return String(process.env.EXPO_PUBLIC_FACE_READ_MOCK || '').trim() === '1';
}

function normalizeFaceRead(body: unknown): FaceReadPayload {
  if (!body || typeof body !== 'object') return MOCK_RESULT;
  const root = body as { face_read?: FaceReadPayload; success?: boolean };
  const fr = root.face_read && typeof root.face_read === 'object' ? root.face_read : (body as FaceReadPayload);
  return {
    apparent_age_estimate: Number(fr.apparent_age_estimate) || MOCK_RESULT.apparent_age_estimate,
    quality: String(fr.quality || 'ok'),
    model_id: fr.model_id,
    model_version: fr.model_version,
  };
}

export async function postFaceRead(imageUri: string): Promise<FaceReadPayload> {
  if (useMockFaceRead()) {
    return { ...MOCK_RESULT };
  }

  const form = new FormData();
  form.append('image', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  try {
    const res = await fetch(`${API_BASE_URL}/api/public/face-read`, {
      method: 'POST',
      body: form,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 503 || res.status === 502) {
        return { ...MOCK_RESULT, model_id: 'fallback_mock', quality: 'low' };
      }
      throw new Error(String((data as { error?: string }).error || 'Face read failed'));
    }
    return normalizeFaceRead(data);
  } catch (e) {
    if (useMockFaceRead()) return { ...MOCK_RESULT };
    throw e instanceof Error ? e : new Error('Face read failed');
  }
}
