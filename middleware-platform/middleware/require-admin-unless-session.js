'use strict';

/**
 * SEC-07 — Admin auth gate that skips only /api/admin/session (login/logout/status).
 * Mount BEFORE registerAdminPlatformRoutes so later app.get('/api/admin/…') still run this first.
 */

const { requireAdminAuth } = require('./admin-auth');

function isAdminSessionPublicPath(req) {
  // When mounted at /api/admin, Express sets req.path to the remainder.
  const p = String(req.path || '').replace(/\/+$/, '') || '/';
  const full = String(req.originalUrl || '').split('?')[0];
  if (p === '/session' || full === '/api/admin/session' || full.endsWith('/api/admin/session')) {
    return true;
  }
  return false;
}

function requireAdminAuthUnlessSession(req, res, next) {
  if (isAdminSessionPublicPath(req)) return next();
  return requireAdminAuth(req, res, next);
}

module.exports = {
  requireAdminAuthUnlessSession,
  isAdminSessionPublicPath,
};
