import { apiUrl } from './apiBase.js';

const MOCK_RESULT = {
  apparent_age_estimate: 31,
  quality: 'ok',
  model_id: 'mock',
  model_version: 'dev',
};

function useMockFaceRead() {
  return String(import.meta.env.VITE_FACE_READ_MOCK || '').trim() === '1';
}

function shouldFallbackToMock(status) {
  if (useMockFaceRead()) return true;
  if (status === 502 || status === 503) return true;
  if (import.meta.env.DEV && status >= 500) return true;
  return false;
}

const ERROR_MESSAGES = {
  face_read_service_not_configured:
    'Skin age service is not available. Try again later or upload a photo.',
  face_read_timeout: 'Analysis timed out. Hold still and try again.',
  face_read_proxy_failed: 'Could not reach analysis service. Upload a photo instead.',
  missing_image: 'No photo received. Try capture or upload again.',
};

function formatFaceReadError(data, status) {
  const code = String(data?.error || '');
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status >= 500) {
    return import.meta.env.DEV
      ? 'Analysis service error (dev mock will apply on retry if enabled).'
      : 'Analysis failed. Try upload instead.';
  }
  return code || 'Face read failed';
}

function normalizeFaceRead(body) {
  if (!body || typeof body !== 'object') return { ...MOCK_RESULT };
  const fr =
    body.face_read && typeof body.face_read === 'object' ? body.face_read : body;
  return {
    apparent_age_estimate:
      Number(fr.apparent_age_estimate) || MOCK_RESULT.apparent_age_estimate,
    quality: String(fr.quality || 'ok'),
    model_id: fr.model_id,
    model_version: fr.model_version,
  };
}

export async function postFaceRead(file) {
  if (useMockFaceRead()) {
    return { ...MOCK_RESULT };
  }

  const form = new FormData();
  form.append('image', file, file.name || 'photo.jpg');

  try {
    const res = await fetch(apiUrl('/api/public/face-read'), {
      method: 'POST',
      body: form,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (shouldFallbackToMock(res.status)) {
        return { ...MOCK_RESULT, model_id: 'fallback_mock', quality: 'low' };
      }
      throw new Error(formatFaceReadError(data, res.status));
    }
    return normalizeFaceRead(data);
  } catch (e) {
    if (useMockFaceRead()) return { ...MOCK_RESULT };
    throw e instanceof Error ? e : new Error('Face read failed');
  }
}
