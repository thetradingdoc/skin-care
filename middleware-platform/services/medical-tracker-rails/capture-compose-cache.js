'use strict';

/**
 * P4.09 — Optional Redis cache for capture_compose.
 * Keys are ALWAYS scoped by patientId or sessionId — content-hash alone is a
 * cross-user privacy bug (similar Rx templates must not share extractions).
 */

const crypto = require('crypto');
const { redisGet, redisSet, isRedisEnabled } = require('../../lib/redis-client');

const TTL_SEC = Math.max(60, Number(process.env.MEDICAL_CAPTURE_COMPOSE_CACHE_TTL_SEC || 900));

/**
 * Stable content fingerprint (does not include patient/session — that goes in cacheKey).
 */
function contentHash({ tag, buffer, mimeType, aiOrManual, userHints }) {
  const h = crypto.createHash('sha256');
  h.update(String(tag || ''));
  h.update(String(aiOrManual || ''));
  h.update(String(mimeType || ''));
  h.update(JSON.stringify(userHints || {}));
  if (buffer && Buffer.isBuffer(buffer)) h.update(buffer);
  return h.digest('hex').slice(0, 32);
}

/**
 * Privacy scope for the Redis key. Prefer patientId; else sessionId.
 * Returns null when neither is present — caller must skip cache (no shared anon bucket).
 */
function cacheScope({ patientId = null, sessionId = null } = {}) {
  const patient = patientId != null && String(patientId).trim() ? String(patientId).trim() : '';
  const session = sessionId != null && String(sessionId).trim() ? String(sessionId).trim() : '';
  if (patient) return `patient:${patient}`;
  if (session) return `session:${session}`;
  return null;
}

/**
 * Redis key: medical:capture_compose:{scope}:{contentHash}
 * Never omit scope — content-hash-only keys are forbidden.
 */
function cacheKey(hash, scopeOrOpts) {
  const scope =
    typeof scopeOrOpts === 'string'
      ? scopeOrOpts
      : cacheScope(scopeOrOpts || {});
  if (!hash || !scope) {
    throw new Error('CACHE_SCOPE_REQUIRED');
  }
  return `medical:capture_compose:${scope}:${hash}`;
}

async function getCachedCompose(hash, scopeOpts) {
  if (!isRedisEnabled() || !hash) return null;
  const scope = cacheScope(scopeOpts || {});
  if (!scope) return null;
  try {
    const raw = await redisGet(cacheKey(hash, scope));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function setCachedCompose(hash, payload, scopeOpts) {
  if (!isRedisEnabled() || !hash || !payload) return false;
  const scope = cacheScope(scopeOpts || {});
  if (!scope) return false;
  try {
    await redisSet(cacheKey(hash, scope), JSON.stringify(payload), TTL_SEC);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  contentHash,
  cacheScope,
  cacheKey,
  getCachedCompose,
  setCachedCompose,
  TTL_SEC,
};
