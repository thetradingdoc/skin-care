'use strict';

/**
 * Verify a Google ID token (credential from GIS) and return the email claim.
 * Fail-closed: never trust body.email without a verified token.
 */

const axios = require('axios');

/**
 * @param {string} credential - Google ID token (JWT)
 * @param {{ clientId?: string, fetchImpl?: typeof axios.get }} [opts]
 * @returns {Promise<{ email: string, name?: string, picture?: string, sub?: string }>}
 */
async function verifyGoogleIdToken(credential, opts = {}) {
  const token = String(credential || '').trim();
  if (!token) {
    const err = new Error('GOOGLE_CREDENTIAL_REQUIRED');
    err.code = 'GOOGLE_CREDENTIAL_REQUIRED';
    throw err;
  }

  const clientId = String(opts.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const get = opts.fetchImpl || ((url) => axios.get(url, { timeout: 10000 }));

  let data;
  try {
    const res = await get(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    data = res && res.data ? res.data : res;
  } catch (e) {
    const err = new Error('GOOGLE_TOKEN_INVALID');
    err.code = 'GOOGLE_TOKEN_INVALID';
    err.cause = e;
    throw err;
  }

  const email = String((data && data.email) || '').trim().toLowerCase();
  if (!email) {
    const err = new Error('GOOGLE_TOKEN_MISSING_EMAIL');
    err.code = 'GOOGLE_TOKEN_MISSING_EMAIL';
    throw err;
  }

  if (String((data && data.email_verified) || '') === 'false') {
    const err = new Error('GOOGLE_EMAIL_NOT_VERIFIED');
    err.code = 'GOOGLE_EMAIL_NOT_VERIFIED';
    throw err;
  }

  if (clientId) {
    const aud = String((data && data.aud) || '');
    if (aud !== clientId) {
      const err = new Error('GOOGLE_AUD_MISMATCH');
      err.code = 'GOOGLE_AUD_MISMATCH';
      throw err;
    }
  } else if (isProdLike()) {
    const err = new Error('GOOGLE_CLIENT_ID_REQUIRED');
    err.code = 'GOOGLE_CLIENT_ID_REQUIRED';
    throw err;
  }

  return {
    email,
    name: data.name ? String(data.name) : undefined,
    picture: data.picture ? String(data.picture) : undefined,
    sub: data.sub ? String(data.sub) : undefined,
  };
}

function isProdLike() {
  const { isProdLikeEnv } = require('./runtime-env');
  return isProdLikeEnv();
}

module.exports = { verifyGoogleIdToken };
