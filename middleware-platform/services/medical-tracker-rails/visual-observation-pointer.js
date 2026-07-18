'use strict';

/**
 * Visual observation pointer — contract for region overlays on skin/mark photos.
 *
 * Honest scope: named zones (or future rough bbox) ONLY.
 * Explicitly forbidden: percentage scores, composite health/age scores, heatmaps
 * that imply measured precision (same rejection discipline as fabricated Progress %).
 *
 * This module is the schema lock. UI may consume it later; shipping scored overlays
 * that violate this contract is a hard fail in tests.
 */

const { VALID_ZONES } = require('../face-read-vision');

/** Allowed keys on a visual pointer payload attached to AI SUGGESTS. */
const VISUAL_POINTER_ALLOWED_KEYS = Object.freeze([
  'zones',
  'zone_labels',
  'labeled',
  'not_diagnosis',
  'text',
  'compare_group_id',
]);

/**
 * Keys / field name patterns that imply fabricated numeric precision.
 * Reject if present on overlay payload (or nested one level).
 */
const FORBIDDEN_SCORE_KEY_PATTERNS = Object.freeze([
  /^.*percent(age)?$/i,
  /^.*_pct$/i,
  /^pct_/i,
  /^score$/i,
  /^.*_score$/i,
  /^health_score/i,
  /^concern_score/i,
  /^moisture/i,
  /^wrinkle/i,
  /^texture_pct/i,
  /^composite/i,
  /^age_estimate$/i,
  /^apparent_age/i,
  /^heatmap/i,
  /^confidence_pct$/i,
]);

function isForbiddenScoreKey(key) {
  const k = String(key || '');
  return FORBIDDEN_SCORE_KEY_PATTERNS.some((re) => re.test(k));
}

/**
 * @param {object|null|undefined} pointer
 * @returns {{ ok: true } | { ok: false, error_code: string, message: string, keys?: string[] }}
 */
function assertVisualPointerShape(pointer) {
  if (pointer == null) return { ok: true };
  if (typeof pointer !== 'object' || Array.isArray(pointer)) {
    return {
      ok: false,
      error_code: 'VISUAL_POINTER_MUST_BE_OBJECT',
      message: 'visual_pointer must be object or null',
    };
  }

  const scoreKeys = Object.keys(pointer).filter(isForbiddenScoreKey);
  if (scoreKeys.length) {
    return {
      ok: false,
      error_code: 'VISUAL_POINTER_NUMERIC_SCORE_FORBIDDEN',
      keys: scoreKeys,
      message: `visual_pointer must not carry percentage/score fields: ${scoreKeys.join(', ')}`,
    };
  }

  const extra = Object.keys(pointer).filter((k) => !VISUAL_POINTER_ALLOWED_KEYS.includes(k));
  if (extra.length) {
    return {
      ok: false,
      error_code: 'VISUAL_POINTER_SCHEMA',
      keys: extra,
      message: `visual_pointer has non-allowlisted keys: ${extra.join(', ')}`,
    };
  }

  if (pointer.not_diagnosis === false) {
    return {
      ok: false,
      error_code: 'NOT_DIAGNOSIS_FLAG_REQUIRED',
      message: 'visual_pointer.not_diagnosis must not be false',
    };
  }

  if (pointer.labeled != null && String(pointer.labeled) !== 'ai_suggestion') {
    return {
      ok: false,
      error_code: 'VISUAL_POINTER_LABEL',
      message: 'visual_pointer.labeled must be ai_suggestion when set',
    };
  }

  if (pointer.zones != null) {
    if (!Array.isArray(pointer.zones)) {
      return {
        ok: false,
        error_code: 'VISUAL_POINTER_ZONES',
        message: 'visual_pointer.zones must be an array of named zones',
      };
    }
    const bad = pointer.zones.filter((z) => !VALID_ZONES.includes(String(z)));
    if (bad.length) {
      return {
        ok: false,
        error_code: 'VISUAL_POINTER_ZONE_ENUM',
        keys: bad.map(String),
        message: `unknown zones: ${bad.join(', ')}`,
      };
    }
  }

  // Reject string values that look like "72%" precision claims
  for (const [k, v] of Object.entries(pointer)) {
    if (typeof v === 'string' && /\d+\s*%/.test(v)) {
      return {
        ok: false,
        error_code: 'VISUAL_POINTER_PERCENT_IN_TEXT',
        keys: [k],
        message: `visual_pointer.${k} must not contain percentage claims`,
      };
    }
    if (typeof v === 'number') {
      return {
        ok: false,
        error_code: 'VISUAL_POINTER_NUMERIC_SCORE_FORBIDDEN',
        keys: [k],
        message: `visual_pointer must not carry numeric score fields (${k})`,
      };
    }
  }

  return { ok: true };
}

/**
 * Build a region-only pointer from vision findings (no scores).
 * @returns {object|null}
 */
function visualPointerFromVision(vision, { text = null, compareGroupId = null } = {}) {
  const findings = Array.isArray(vision?.findings) ? vision.findings : [];
  const zones = [];
  for (const f of findings) {
    for (const z of Array.isArray(f.zones) ? f.zones : []) {
      if (VALID_ZONES.includes(z) && !zones.includes(z)) zones.push(z);
    }
  }
  const { ZONE_LABELS } = require('../face-read-vision');
  const region = String(vision?.observed_region || '').trim().slice(0, 80);
  const zone_labels = zones.length
    ? zones.map((z) => ZONE_LABELS[z] || z)
    : region
      ? [region]
      : [];
  if (!zones.length && !zone_labels.length && !text) return null;
  const pointer = {
    zones,
    zone_labels,
    labeled: 'ai_suggestion',
    not_diagnosis: true,
  };
  if (text) pointer.text = String(text).slice(0, 2000);
  if (compareGroupId) pointer.compare_group_id = String(compareGroupId);
  return pointer;
}

module.exports = {
  VISUAL_POINTER_ALLOWED_KEYS,
  FORBIDDEN_SCORE_KEY_PATTERNS,
  isForbiddenScoreKey,
  assertVisualPointerShape,
  visualPointerFromVision,
};
