import { apiUrl } from './apiBase.js';

const MOCK_MODEL_IDS = new Set(['mock', 'fallback_mock', 'dev']);

const ERROR_MESSAGES = {
  face_read_service_not_configured:
    'Skin age analysis is not available yet. Try again in a few minutes or upload a photo.',
  face_read_timeout: 'Analysis timed out. Hold still and try again.',
  face_read_proxy_failed: 'Could not reach the analysis service. Try upload instead.',
  missing_image: 'No photo received. Try capture or upload again.',
  invalid_response: 'Could not read a skin age from that photo. Try again with even lighting.',
};

const GATE_REJECT_REASONS = new Set(['not_a_face', 'face_too_small', 'wrong_subject']);

export function isRejectedFaceRead(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return Boolean(payload.reject_reason && GATE_REJECT_REASONS.has(payload.reject_reason));
}

export function isLiveFaceRead(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (isRejectedFaceRead(payload)) return false;
  const age = Number(payload.apparent_age_estimate);
  if (!Number.isFinite(age) || age < 10 || age > 99) return false;
  const modelId = String(payload.model_id || '').trim().toLowerCase();
  if (!modelId || MOCK_MODEL_IDS.has(modelId)) return false;
  return true;
}

function formatFaceReadError(data, status) {
  const code = String(data?.error || '');
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (status >= 500) return 'Analysis failed. Try again or upload a different photo.';
  return code || 'Face read failed';
}

function normalizeFaceRead(body) {
  if (!body || typeof body !== 'object') {
    throw new Error(ERROR_MESSAGES.invalid_response);
  }
  const fr = body.face_read && typeof body.face_read === 'object' ? body.face_read : body;

  if (isRejectedFaceRead(fr)) {
    const err = new Error(fr.user_message || 'We could not analyze this photo.');
    err.code = 'face_read_rejected';
    err.rejectReason = fr.reject_reason;
    err.faceRead = {
      reject_reason: fr.reject_reason,
      user_message: fr.user_message,
      quality: fr.quality,
      quality_flags: fr.quality_flags || [],
    };
    throw err;
  }

  const payload = {
    apparent_age_estimate: Number(fr.apparent_age_estimate),
    quality: String(fr.quality || 'ok'),
    model_id: fr.model_id != null ? String(fr.model_id) : undefined,
    model_version: fr.model_version != null ? String(fr.model_version) : undefined,
    zone_ages: fr.zone_ages && typeof fr.zone_ages === 'object' ? fr.zone_ages : undefined,
    zone_ages_estimated: fr.zone_ages_estimated === true,
    zone_polygons: fr.zone_polygons && typeof fr.zone_polygons === 'object' ? fr.zone_polygons : {},
    face_bbox: fr.face_bbox && typeof fr.face_bbox === 'object' ? fr.face_bbox : null,
    concern_scores: fr.concern_scores && typeof fr.concern_scores === 'object' ? fr.concern_scores : {},
    findings: Array.isArray(fr.findings) ? fr.findings : [],
    scan_summary: fr.scan_summary != null ? String(fr.scan_summary) : '',
    positive_observations: Array.isArray(fr.positive_observations) ? fr.positive_observations : [],
    fit_skin_tone: fr.fit_skin_tone != null ? String(fr.fit_skin_tone) : undefined,
    fitzpatrick_estimate: fr.fitzpatrick_estimate != null ? String(fr.fitzpatrick_estimate) : undefined,
    quality_flags: Array.isArray(fr.quality_flags) ? fr.quality_flags : [],
    vision_enabled: fr.vision_enabled === true,
    vision_error: fr.vision_error != null ? String(fr.vision_error) : null,
    not_diagnosis: fr.not_diagnosis !== false,
  };

  if (!isLiveFaceRead(payload)) {
    throw new Error(ERROR_MESSAGES.invalid_response);
  }
  return payload;
}

export async function postFaceRead(file) {
  const form = new FormData();
  form.append('image', file, file.name || 'photo.jpg');

  const res = await fetch(apiUrl('/api/public/face-read'), {
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
