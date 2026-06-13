import { getEffectiveApiBaseUrl } from '@/config';
import type { FaceReadPayload } from '@/lib/onboarding-storage';

const MOCK_MODEL_IDS = new Set(['mock', 'fallback_mock', 'dev']);

const ERROR_MESSAGES: Record<string, string> = {
  face_read_service_not_configured:
    'Skin age analysis is not available yet. Try again in a few minutes.',
  face_read_timeout: 'Analysis timed out. Hold still and try again.',
  face_read_proxy_failed: 'Could not reach the analysis service.',
  missing_image: 'No photo received. Try capture or upload again.',
  invalid_response: 'Could not read a skin age from that photo. Try again with even lighting.',
};

export function isLiveFaceRead(payload: FaceReadPayload | null | undefined): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const age = Number(payload.apparent_age_estimate);
  if (!Number.isFinite(age) || age < 10 || age > 99) return false;
  const modelId = String(payload.model_id || '').trim().toLowerCase();
  if (!modelId || MOCK_MODEL_IDS.has(modelId)) return false;
  return true;
}

function formatFaceReadError(data: unknown, status: number): string {
  const code = String((data as { error?: string })?.error || '');
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status >= 500) return 'Analysis failed. Try again or upload a different photo.';
  return code || 'Face read failed';
}

function normalizeFaceRead(body: unknown): FaceReadPayload {
  if (!body || typeof body !== 'object') {
    throw new Error(ERROR_MESSAGES.invalid_response);
  }
  const root = body as { face_read?: FaceReadPayload };
  const fr =
    root.face_read && typeof root.face_read === 'object' ? root.face_read : (body as FaceReadPayload);

  if (fr.reject_reason) {
    throw new Error(String(fr.user_message || fr.reject_reason));
  }

  const payload: FaceReadPayload = {
    apparent_age_estimate: Number(fr.apparent_age_estimate),
    quality: String(fr.quality || 'ok'),
    model_id: fr.model_id != null ? String(fr.model_id) : undefined,
    model_version: fr.model_version != null ? String(fr.model_version) : undefined,
    vision_enabled: fr.vision_enabled === true,
    vision_error: fr.vision_error ?? null,
    findings: Array.isArray(fr.findings) ? fr.findings : [],
    concern_scores:
      fr.concern_scores && typeof fr.concern_scores === 'object' ? fr.concern_scores : {},
    scan_summary: fr.scan_summary != null ? String(fr.scan_summary) : '',
    positive_observations: Array.isArray(fr.positive_observations)
      ? fr.positive_observations.map(String)
      : [],
    fit_skin_tone: fr.fit_skin_tone != null ? String(fr.fit_skin_tone) : undefined,
    fitzpatrick_estimate:
      fr.fitzpatrick_estimate != null ? String(fr.fitzpatrick_estimate) : undefined,
    zone_polygons:
      fr.zone_polygons && typeof fr.zone_polygons === 'object' ? fr.zone_polygons : undefined,
  };
  if (!isLiveFaceRead(payload)) {
    throw new Error(ERROR_MESSAGES.invalid_response);
  }
  return payload;
}

export async function postFaceRead(imageUri: string): Promise<FaceReadPayload> {
  const form = new FormData();
  form.append('image', {
    uri: imageUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${getEffectiveApiBaseUrl()}/api/public/face-read`, {
    method: 'POST',
    body: form,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatFaceReadError(data, res.status));
  }
  return normalizeFaceRead(data);
}
