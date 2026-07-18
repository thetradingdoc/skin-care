'use strict';

/**
 * SEC-13 — Signed session tokens for provider/dashboard login responses.
 * Replaces forgeable `Buffer.from(email).toString('base64')`.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function resolveSessionJwtSecret() {
  const secret =
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.ADMIN_PORTAL_SECRET ||
    '';
  return String(secret || '').trim();
}

/**
 * @param {{ id: string, email: string, role?: string, merchant_id?: string|null }} user
 * @returns {string}
 */
function mintUserSessionToken(user) {
  const secret = resolveSessionJwtSecret();
  if (!secret) {
    const err = new Error('SESSION_JWT_SECRET_REQUIRED');
    err.code = 'SESSION_JWT_SECRET_REQUIRED';
    throw err;
  }
  const payload = {
    sub: String(user.id),
    email: String(user.email || '').toLowerCase(),
    role: user.role || null,
    merchant_id: user.merchant_id || null,
    typ: 'user_session',
    jti: crypto.randomBytes(16).toString('hex'),
  };
  return jwt.sign(payload, secret, { expiresIn: '8h' });
}

/**
 * @param {string} token
 * @returns {object|null}
 */
function verifyUserSessionToken(token) {
  const secret = resolveSessionJwtSecret();
  if (!secret || !token) return null;
  try {
    const decoded = jwt.verify(String(token), secret);
    if (decoded.typ && decoded.typ !== 'user_session') return null;
    return decoded;
  } catch {
    return null;
  }
}

/** Reject forgeable base64(email) tokens. */
function isLegacyBase64EmailToken(token, email) {
  if (!token || !email) return false;
  try {
    const decoded = Buffer.from(String(token), 'base64').toString('utf8');
    return decoded.toLowerCase() === String(email).toLowerCase();
  } catch {
    return false;
  }
}

module.exports = {
  mintUserSessionToken,
  verifyUserSessionToken,
  resolveSessionJwtSecret,
  isLegacyBase64EmailToken,
};
