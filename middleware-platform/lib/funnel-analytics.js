'use strict';

/** Allowed anonymous funnel UI event types (security observability). */
const ALLOWED_FUNNEL_EVENT_TYPES = new Set([
  'page_view',
  'consent_accepted',
  'click_shutter',
  'click_upload',
  'concern_selected',
  'signup_cta',
  'quick_check_completed',
  'reveal_cta',
  'funnel_queued',
]);

const PHI_EXACT_KEYS = new Set([
  'email',
  'phone',
  'name',
  'otp',
  'code',
  'password',
  'zip',
  'address',
  'birth',
  'ssn',
  'inquiry',
  'notes',
  'message',
  'transcript',
]);

const PHI_SUBSTRING_KEYS = [
  'token',
  'photo',
  'image',
  'face_read',
  'patient_email',
  'patient_phone',
  'patient_name',
  'verification',
];

function isPhiKey(key) {
  const k = String(key || '').toLowerCase();
  if (PHI_EXACT_KEYS.has(k)) return true;
  return PHI_SUBSTRING_KEYS.some((part) => k.includes(part));
}

/**
 * Strip PHI-like keys from funnel event payloads. Returns null if entire payload rejected.
 */
function sanitizeFunnelPayload(input) {
  if (input == null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (isPhiKey(k)) continue;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      const nested = sanitizeFunnelPayload(v);
      if (Object.keys(nested).length) out[k] = nested;
      continue;
    }
    if (typeof v === 'string' && v.length > 200) {
      out[k] = `${v.slice(0, 197)}...`;
      continue;
    }
    if (['string', 'number', 'boolean'].includes(typeof v) || v === null) {
      out[k] = v;
    }
  }
  return out;
}

function assertAllowedEventType(eventType) {
  const t = String(eventType || '').trim();
  if (!t || !ALLOWED_FUNNEL_EVENT_TYPES.has(t)) {
    const err = new Error('invalid_event_type');
    err.code = 'invalid_event_type';
    throw err;
  }
  return t;
}

module.exports = {
  ALLOWED_FUNNEL_EVENT_TYPES,
  sanitizeFunnelPayload,
  assertAllowedEventType,
  isPhiKey,
};
