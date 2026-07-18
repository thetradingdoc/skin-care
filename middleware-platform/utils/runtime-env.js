'use strict';

/**
 * Shared prod-like detection for fail-closed secret / route gates.
 * Cloud Run production sets K_SERVICE and STAGING=0.
 */
function isProdLikeEnv(env = process.env) {
  const nodeEnv = String(env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') return true;
  if (env.K_SERVICE && String(env.STAGING || '') === '0') return true;
  return false;
}

module.exports = { isProdLikeEnv };
