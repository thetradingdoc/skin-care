'use strict';

const { MODEL_ID: VISION_MODEL_ID } = require('./face-read-vision');

const GATE_REJECT_REASONS = new Set(['not_a_face', 'face_too_small']);

function enrichZoneAges(faceRead) {
  if (process.env.FACE_READ_SYNTHETIC_ZONES !== '1') {
    return faceRead;
  }
  if (!faceRead || typeof faceRead !== 'object') return faceRead;
  if (faceRead.zone_ages && typeof faceRead.zone_ages === 'object') return faceRead;
  const base = Number(faceRead.apparent_age_estimate);
  if (!Number.isFinite(base)) return faceRead;
  return {
    ...faceRead,
    zone_ages: {
      forehead: Math.round(base - 1),
      t_zone: Math.round(base + 2),
      cheeks: Math.round(base),
    },
    zone_ages_estimated: true,
  };
}

function isGateReject(cvResult) {
  return Boolean(cvResult?.reject_reason && GATE_REJECT_REASONS.has(cvResult.reject_reason));
}

function buildGateRejectFaceRead(cvResult) {
  return {
    quality: cvResult.quality || 'no_face',
    reject_reason: cvResult.reject_reason,
    quality_flags: cvResult.quality_flags || [],
    user_message: cvResult.user_message || 'We could not analyze this photo. Try again.',
    findings: [],
    concern_scores: {},
    scan_summary: '',
    positive_observations: [],
    model_id: cvResult.model_id,
    model_version: cvResult.model_version,
    not_diagnosis: true,
  };
}

function buildWrongSubjectFaceRead(vision) {
  return {
    quality: 'wrong_subject',
    reject_reason: 'wrong_subject',
    quality_flags: ['wrong_subject'],
    user_message:
      vision.user_message ||
      'This looks like a body part — we need your face for this scan.',
    findings: [],
    concern_scores: {},
    scan_summary: '',
    positive_observations: [],
    model_id: vision.model_id || VISION_MODEL_ID,
    model_version: vision.model_version,
    not_diagnosis: true,
  };
}

/**
 * Merge OpenCV inference (Stage 1+2) with optional GPT vision (Stage 3).
 */
function mergeFaceReadResults(cvResult, visionResult, { visionError = null } = {}) {
  if (isGateReject(cvResult)) {
    return buildGateRejectFaceRead(cvResult);
  }

  if (visionResult?.reject_reason === 'wrong_subject') {
    return buildWrongSubjectFaceRead(visionResult);
  }

  const qualityFlags = [...(cvResult?.quality_flags || [])];
  if (visionResult?.quality === 'low') qualityFlags.push('vision_low_confidence');
  if (visionError) qualityFlags.push('vision_failed');

  const age = Number(cvResult?.apparent_age_estimate);
  const visionAge = Number(visionResult?.apparent_age_estimate);

  const merged = {
    apparent_age_estimate: Number.isFinite(age)
      ? age
      : Number.isFinite(visionAge)
        ? visionAge
        : null,
    quality: cvResult?.quality || visionResult?.quality || 'ok',
    quality_flags: qualityFlags,
    reject_reason: null,
    user_message: null,
    face_bbox: cvResult?.face_bbox ?? null,
    face_score: cvResult?.face_score ?? null,
    face_count: cvResult?.face_count ?? null,
    zone_polygons: cvResult?.zone_polygons ?? {},
    fit_skin_tone: visionResult?.fit_skin_tone ?? null,
    fitzpatrick_estimate: visionResult?.fitzpatrick_estimate ?? null,
    concern_scores: visionResult?.concern_scores ?? {},
    findings: visionResult?.findings ?? [],
    scan_summary: visionResult?.scan_summary ?? '',
    positive_observations: visionResult?.positive_observations ?? [],
    not_diagnosis: true,
    vision_enabled: process.env.FACE_READ_VISION_ENABLED === '1',
    vision_error: visionError || null,
    model_id: visionResult?.model_id || cvResult?.model_id,
    model_version: visionResult?.model_version || cvResult?.model_version,
    zone_ages_estimated: false,
  };

  if (visionResult?.zone_ages && typeof visionResult.zone_ages === 'object') {
    merged.zone_ages = visionResult.zone_ages;
  }

  return enrichZoneAges(merged);
}

module.exports = {
  mergeFaceReadResults,
  enrichZoneAges,
  isGateReject,
  buildGateRejectFaceRead,
  buildWrongSubjectFaceRead,
  GATE_REJECT_REASONS,
};
