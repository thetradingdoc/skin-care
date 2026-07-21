'use strict';

/**
 * In-flight idempotency for Progress Kelly generation.
 * Pattern matched from auto-checkout-after-schedule.js (in-memory Map of promises):
 * concurrent callers for the same key await the same generation — no double LLM.
 *
 * Process-local only (single Cloud Run instance). Multi-instance races are
 * additionally bounded by the service-level 5-minute rate limit on last_attempt_at.
 */

const inFlightByKey = new Map();

function buildKey(patientId, markId) {
  return `${String(patientId || '').trim()}::${String(markId || '').trim()}`;
}

/**
 * @template T
 * @param {string} patientId
 * @param {string} markId
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withProgressKellyInflight(patientId, markId, fn) {
  const key = buildKey(patientId, markId);
  if (!key || key.startsWith('::') || key.endsWith('::')) {
    return fn();
  }

  const existing = inFlightByKey.get(key);
  if (existing) {
    return existing;
  }

  const promise = (async () => fn())().finally(() => {
    if (inFlightByKey.get(key) === promise) {
      inFlightByKey.delete(key);
    }
  });

  inFlightByKey.set(key, promise);
  return promise;
}

/** Test helper — clear all locks. */
function _resetProgressKellyInflightForTests() {
  inFlightByKey.clear();
}

/** Test helper — number of keys currently locked. */
function _inflightSizeForTests() {
  return inFlightByKey.size;
}

module.exports = {
  withProgressKellyInflight,
  buildKey,
  _resetProgressKellyInflightForTests,
  _inflightSizeForTests,
};
