'use strict';

const path = require('path');
const fs = require('fs');

function getHostname(req) {
  const host = req.headers.host;
  if (!host) return '';
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    if (end !== -1) return host.slice(1, end);
  }
  const idx = host.lastIndexOf(':');
  if (idx > 0 && !host.includes(']')) return host.slice(0, idx);
  return host;
}

/**
 * Consumer marketing hostnames that receive skin-care-landing at `/`.
 * Primary production target: myskinandcare.com (DNS cutover pending).
 * callsomo.com remains listed for shared Firebase hosting until redirect/cutover.
 */
function isConsumerMarketingHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  return (
    h === 'myskinandcare.com' ||
    h === 'www.myskinandcare.com' ||
    h === 'skinandcare.com' ||
    h === 'www.skinandcare.com' ||
    h === 'callsomo.com' ||
    h === 'www.callsomo.com'
  );
}

/** @deprecated use isConsumerMarketingHostname */
const isSomoMarketingHostname = isConsumerMarketingHostname;

function isLocalDevRootHost(hostname) {
  if (!hostname) return false;
  const h = String(hostname).toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';
  if (isProd) return false;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h);
}

function shouldServeConsumerLanding(hostname) {
  return isConsumerMarketingHostname(hostname) || isLocalDevRootHost(hostname);
}

/** @deprecated use shouldServeConsumerLanding */
const shouldServeSomoLanding = shouldServeConsumerLanding;

/** Marketing static HTML at unified-dashboard root (not SPA). */
const MARKETING_STATIC_HTML = Object.freeze(['/about.html', '/contact.html']);

function isMarketingStaticHtmlPath(p) {
  const pathname = String(p || '').split('?')[0];
  return MARKETING_STATIC_HTML.includes(pathname);
}

/** Unified-dashboard portal static prefixes (must not receive landing SPA index.html). */
function isUnifiedDashboardAssetPath(p) {
  return (
    p.startsWith('/assets/js') ||
    p.startsWith('/assets/css') ||
    p.startsWith('/assets/images') ||
    p.startsWith('/assets/brand') ||
    p.startsWith('/assets/data') ||
    p.startsWith('/business/assets')
  );
}

const SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML =
  '<!DOCTYPE html><html><body style="font-family:system-ui;padding:2rem">' +
  '<h1>Skin &amp; Care</h1><p>Landing build not found or out of date. Run:</p>' +
  '<pre style="background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto">cd middleware-platform && npm run build:skin-care-landing</pre>' +
  '<p>Or restart with <code>npm start</code> (runs prestart build check).</p>' +
  '</body></html>';

/** @deprecated use SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML */
const SOMO_LANDING_BUILD_INSTRUCTIONS_HTML = SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML;

function parseLandingMainBundleSrc(html) {
  const m = String(html).match(
    /<script[^>]+type=["']module["'][^>]+src=["'](\/assets\/index-[^"']+\.js)["']/i
  );
  if (m) return m[1];
  const m2 = String(html).match(/src=["'](\/assets\/index-[^"']+\.js)["']/i);
  return m2 ? m2[1] : null;
}

/** True when build/index.html exists and its hashed JS bundle is on disk (not dev /src/main.jsx). */
function isSkinCareLandingBuildReady(getSkinCareLandingBuildPath) {
  const indexPath = getSkinCareLandingBuildPath('index.html');
  if (!fs.existsSync(indexPath)) return false;
  const html = fs.readFileSync(indexPath, 'utf8');
  const src = parseLandingMainBundleSrc(html);
  if (!src || src.includes('/src/')) return false;
  const bundlePath = getSkinCareLandingBuildPath(src.replace(/^\//, ''));
  return fs.existsSync(bundlePath) && fs.statSync(bundlePath).isFile();
}

/** @deprecated use isSkinCareLandingBuildReady */
const isSomoLandingBuildReady = isSkinCareLandingBuildReady;

function isConsumerLandingApiPath(p) {
  return (
    p.startsWith('/api') ||
    p.startsWith('/fhir') ||
    p.startsWith('/voice') ||
    p.startsWith('/webhooks') ||
    p.startsWith('/health') ||
    p.startsWith('/signup') ||
    p.startsWith('/login') ||
    p.startsWith('/docs') ||
    p.startsWith('/terms') ||
    p.startsWith('/verify-card') ||
    p.startsWith('/reset-password') ||
    p.startsWith('/patients') ||
    p.startsWith('/business') ||
    p.startsWith('/admin') ||
    p.startsWith('/unified-dashboard') ||
    isUnifiedDashboardAssetPath(p)
  );
}

/** @deprecated use isConsumerLandingApiPath */
const isSomoLandingApiPath = isConsumerLandingApiPath;

function createStaticPathHelpers(rootDir) {
  function getUnifiedDashboardPath(...subPaths) {
    let azurePath = path.join(rootDir, 'unified-dashboard', ...subPaths);
    if (fs.existsSync(azurePath)) {
      return azurePath;
    }
    return path.join(rootDir, '..', 'unified-dashboard', ...subPaths);
  }

  function getSkinCareLandingBuildPath(...subPaths) {
    let azurePath = path.join(rootDir, 'unified-dashboard', 'skin-care-landing', 'build', ...subPaths);
    if (fs.existsSync(azurePath)) {
      return azurePath;
    }
    return path.join(rootDir, '..', 'unified-dashboard', 'skin-care-landing', 'build', ...subPaths);
  }

  /** @deprecated use getSkinCareLandingBuildPath */
  const getSomoLandingBuildPath = getSkinCareLandingBuildPath;

  function trySendSkinCareLanding(res) {
    if (!isSkinCareLandingBuildReady(getSkinCareLandingBuildPath)) return false;
    res.sendFile(path.resolve(getSkinCareLandingBuildPath('index.html')));
    return true;
  }

  /** @deprecated use trySendSkinCareLanding */
  const trySendSomoLanding = trySendSkinCareLanding;

  function sendSkinCareLandingOrInstructions(res) {
    if (trySendSkinCareLanding(res)) return;
    res.status(503).type('html').send(SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML);
  }

  /** @deprecated use sendSkinCareLandingOrInstructions */
  const sendSomoLandingOrInstructions = sendSkinCareLandingOrInstructions;

  return {
    getUnifiedDashboardPath,
    getSkinCareLandingBuildPath,
    getSomoLandingBuildPath,
    trySendSkinCareLanding,
    trySendSomoLanding,
    sendSkinCareLandingOrInstructions,
    sendSomoLandingOrInstructions,
  };
}

module.exports = {
  createStaticPathHelpers,
  getHostname,
  isConsumerMarketingHostname,
  isSomoMarketingHostname,
  isLocalDevRootHost,
  shouldServeConsumerLanding,
  shouldServeSomoLanding,
  isMarketingStaticHtmlPath,
  MARKETING_STATIC_HTML,
  isUnifiedDashboardAssetPath,
  isConsumerLandingApiPath,
  isSomoLandingApiPath,
  SKIN_CARE_LANDING_BUILD_INSTRUCTIONS_HTML,
  SOMO_LANDING_BUILD_INSTRUCTIONS_HTML,
  parseLandingMainBundleSrc,
  isSkinCareLandingBuildReady,
  isSomoLandingBuildReady,
};
