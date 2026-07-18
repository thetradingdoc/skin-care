'use strict';

const { isProdLikeEnv } = require('../utils/runtime-env');

/**
 * Block /api/test/* in production-like environments unless ALLOW_TEST_ENDPOINTS=1.
 * Returns 404 (not 403) to avoid advertising the surface.
 */
function blockTestEndpointsInProduction(req, res, next) {
  const path = String(req.path || '');
  const original = String(req.originalUrl || '');
  const isTest =
    path === '/api/test' ||
    path.startsWith('/api/test/') ||
    original.startsWith('/api/test/') ||
    original.split('?')[0] === '/api/test';

  if (!isTest) return next();

  if (isProdLikeEnv() && String(process.env.ALLOW_TEST_ENDPOINTS || '') !== '1') {
    return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  }
  return next();
}

module.exports = { blockTestEndpointsInProduction };
