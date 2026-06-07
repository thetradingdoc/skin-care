'use strict';

const fs = require('fs');
const path = require('path');

const {
  createStaticPathHelpers,
  getHostname,
  shouldServeConsumerLanding,
  isConsumerLandingApiPath,
  isUnifiedDashboardAssetPath,
  isSkinCareLandingBuildReady,
  SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML,
} = require('../lib/static-hosting-paths');

/** Legacy littlelab SPA paths — redirect to / in server.js route handlers. */
const LEGACY_LANDING_REDIRECT_PREFIXES = [
  '/start',
  '/find-provider',
  '/about',
  '/shop',
  '/products',
  '/cart',
  '/checkout',
  '/coverage',
  '/landing',
  '/landing.html',
  '/how-it-works',
  '/skin-care',
];

/**
 * Mount shared static assets for unified-dashboard HTML portals.
 * Skin & Care consumer landing SPA shell is served from early static middleware.
 */
function registerStaticHosting(app, { express, rootDir }) {
  const {
    getUnifiedDashboardPath,
    getSkinCareLandingBuildPath,
  } = createStaticPathHelpers(rootDir);

  app.use('/unified-dashboard', express.static(getUnifiedDashboardPath(), {
    index: false,
    extensions: ['html'],
    maxAge: '5m',
  }));

  app.get('/manifest.webmanifest', (req, res) => {
    const manifestPath = getUnifiedDashboardPath('manifest.webmanifest');
    if (require('fs').existsSync(manifestPath)) {
      res.type('application/manifest+json');
      res.sendFile(manifestPath);
    } else {
      res.status(404).json({ error: 'Manifest not found' });
    }
  });

  app.use('/assets', express.static(getUnifiedDashboardPath('assets'), { maxAge: '1d' }));
  app.use('/business/assets', express.static(getUnifiedDashboardPath('assets'), { maxAge: '1d' }));

  const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
  app.use('/skin-care-landing-assets', express.static(getSkinCareLandingBuildPath('assets'), {
    maxAge: isProd ? '1y' : 0,
    immutable: isProd,
  }));
  // Legacy alias for older deploy bundles
  app.use('/somo-landing-assets', express.static(getSkinCareLandingBuildPath('assets'), {
    maxAge: isProd ? '1y' : 0,
    immutable: isProd,
  }));

  return {
    getUnifiedDashboardPath,
    getSkinCareLandingBuildPath,
    getSomoLandingBuildPath: getSkinCareLandingBuildPath,
  };
}

/**
 * Serve Skin & Care consumer landing static files before the heavy global middleware stack.
 * GET/HEAD only; API and portal paths pass through.
 */
function registerEarlyConsumerLandingStatic(app, { express, rootDir }) {
  const { getSkinCareLandingBuildPath, getUnifiedDashboardPath } = createStaticPathHelpers(rootDir);

  const STATIC_EXT = /\.(js|mjs|css|json|woff2?|png|jpe?g|gif|svg|ico|webp)$/i;

  function trySendBuildFile(res, filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
    res.sendFile(path.resolve(filePath));
    return true;
  }

  function trySendLandingBuildAsset(req, res) {
    if (!req.path.startsWith('/assets/')) return false;
    const rel = req.path.replace(/^\//, '');
    if (!rel || rel.includes('..')) return false;
    return trySendBuildFile(res, getSkinCareLandingBuildPath(rel));
  }

  function trySendUnifiedDashboardAsset(req, res) {
    if (!req.path.startsWith('/assets/')) return false;
    const rel = req.path.replace(/^\/assets\//, '');
    if (!rel || rel.includes('..')) return false;
    return trySendBuildFile(res, getUnifiedDashboardPath('assets', rel));
  }

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (!shouldServeConsumerLanding(getHostname(req))) return next();
    if (isConsumerLandingApiPath(req.path)) return next();

    if (trySendLandingBuildAsset(req, res)) return;
    if (trySendUnifiedDashboardAsset(req, res)) return;

    if (isUnifiedDashboardAssetPath(req.path)) return next();

    if (req.path.startsWith('/assets/')) {
      if (STATIC_EXT.test(req.path) && !res.headersSent) {
        res.status(404).end();
      }
      return;
    }

    if (isSkinCareLandingBuildReady(getSkinCareLandingBuildPath)) {
      res.sendFile(path.resolve(getSkinCareLandingBuildPath('index.html')));
      return;
    }
    if (!STATIC_EXT.test(req.path) && !res.headersSent) {
      res.status(503).type('html').send(SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML);
    }
  });
}

/** @deprecated use registerEarlyConsumerLandingStatic */
const registerEarlySomoLandingStatic = registerEarlyConsumerLandingStatic;

module.exports = {
  registerStaticHosting,
  registerEarlyConsumerLandingStatic,
  registerEarlySomoLandingStatic,
  LEGACY_LANDING_REDIRECT_PREFIXES,
};
