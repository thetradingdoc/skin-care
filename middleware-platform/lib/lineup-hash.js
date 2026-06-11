'use strict';

const crypto = require('crypto');

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Stable hash for a daily lineup + optional bio snapshot.
 * @param {object} opts
 * @param {Array} opts.slots
 * @param {object} [opts.bioProfile]
 */
function computeLineupHash({ slots = [], bioProfile = null } = {}) {
  const payload = {
    slots,
    bio: bioProfile
      ? {
          conditions: bioProfile.conditions || [],
          prescriptions: bioProfile.prescriptions || [],
          sensitivity: bioProfile.sensitivity || 'none',
        }
      : null,
  };
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 16);
}

module.exports = { computeLineupHash };
