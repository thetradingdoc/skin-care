const MOCK_RESULT = {
  apparent_age_estimate: 31,
  quality: 'ok',
  model_id: 'mock',
  model_version: 'dev',
};

function useMockFaceRead() {
  return String(import.meta.env.VITE_FACE_READ_MOCK || '').trim() === '1';
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
    const res = await fetch('/api/public/face-read', {
      method: 'POST',
      body: form,
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 503 || res.status === 502) {
        return { ...MOCK_RESULT, model_id: 'fallback_mock', quality: 'low' };
      }
      throw new Error(String(data?.error || 'Face read failed'));
    }
    return normalizeFaceRead(data);
  } catch (e) {
    if (useMockFaceRead()) return { ...MOCK_RESULT };
    throw e instanceof Error ? e : new Error('Face read failed');
  }
}
