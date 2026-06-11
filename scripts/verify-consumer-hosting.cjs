#!/usr/bin/env node
'use strict';

/**
 * Verify consumer hosting bundle (hosting-dist-consumer).
 * Usage:
 *   node scripts/verify-consumer-hosting.cjs
 *   node scripts/verify-consumer-hosting.cjs --live https://myskinandcare.com
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOSTING_DIST = path.join(ROOT, 'unified-dashboard', 'hosting-dist-consumer');
const LIVE_ARG = process.argv.find((a) => a.startsWith('--live'));
const LIVE_BASE = LIVE_ARG ? process.argv[process.argv.indexOf(LIVE_ARG) + 1] : null;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function findMaterialIconsFont(distRoot) {
  const fontsDir = path.join(
    distRoot,
    'app',
    'assets',
    'node_modules',
    '@expo',
    'vector-icons',
    'build',
    'vendor',
    'react-native-vector-icons',
    'Fonts'
  );
  if (!fs.existsSync(fontsDir)) return null;
  const match = fs.readdirSync(fontsDir).find((f) => /^MaterialIcons.*\.ttf$/i.test(f));
  return match ? path.join(fontsDir, match) : null;
}

function materialIconsFontRelPath(distRoot) {
  const abs = findMaterialIconsFont(distRoot);
  if (!abs) return null;
  return path.relative(distRoot, abs).split(path.sep).join('/');
}

async function verifyLocalDist() {
  const indexPath = path.join(HOSTING_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail(`Missing ${indexPath}. Run: npm run build:consumer-hosting`);
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!/Track today|Facial Age Checker/i.test(html)) {
    fail('index.html missing Skin & Care hero copy');
  }
  ok('index.html has landing hero');

  for (const rel of [
    'about.html',
    'contact.html',
    'waitlist.html',
    'patients/legal/privacy.html',
    'patients/patient-login.html',
    'app/index.html',
    'app/(tabs)/scan.html',
    'app/verdict/[productId].html',
    'assets/js/api-base.js',
    'assets/js/contact-form.js',
    'assets/css/logo-wordmark.css',
    'assets/brand/fonts/BeVietnamPro-BoldItalic.ttf',
  ]) {
    const p = path.join(HOSTING_DIST, rel);
    if (!fs.existsSync(p)) {
      fail(`Missing ${rel}. Run: node scripts/build-consumer-hosting.cjs (or middleware-platform/scripts/ensure-conflict-engine-hosting.cjs)`);
    }
    ok(rel);
  }

  const apiBase = fs.readFileSync(path.join(HOSTING_DIST, 'assets/js/api-base.js'), 'utf8');
  if (!apiBase.includes('api.callsomo.com')) {
    fail('api-base.js should default to api.callsomo.com');
  }
  ok('api-base.js → api.callsomo.com');

  const loginStub = fs.readFileSync(path.join(HOSTING_DIST, 'patients', 'patient-login.html'), 'utf8');
  if (!loginStub.includes('/app/sign-in')) {
    fail('patient-login.html stub must redirect to /app/sign-in');
  }
  ok('patient-login.html → /app/sign-in stub');

  const signInHtml = fs.readFileSync(path.join(HOSTING_DIST, 'app', 'index.html'), 'utf8');
  if (!signInHtml.includes('/app') && !signInHtml.includes('sign-in')) {
    console.warn('⚠️  app/index.html may not be Expo sign-in bundle — confirm expo export');
  } else {
    ok('app/index.html (Expo web bundle)');
  }
  if (!signInHtml.includes('/favicon.svg')) {
    fail('app/index.html must reference tulip /favicon.svg (not only /app/favicon.ico)');
  }
  ok('app/index.html tulip favicon links');

  const rootFavicon = path.join(HOSTING_DIST, 'favicon.ico');
  if (!fs.existsSync(rootFavicon)) {
    fail('Missing favicon.ico at bundle root');
  }
  ok('favicon.ico at bundle root');

  const assetsDir = path.join(HOSTING_DIST, 'assets');
  const js = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/i.test(f));
  if (!js.length) fail('No landing JS bundle in assets/');
  const jsText = fs.readFileSync(path.join(assetsDir, js[0]), 'utf8');
  if (!jsText.includes('api.callsomo.com') && !jsText.includes('/api/public')) {
    console.warn('⚠️  Landing JS may not embed VITE_API_BASE — confirm production build env');
  } else {
    ok('landing JS bundle present');
  }

  const iconFont = findMaterialIconsFont(HOSTING_DIST);
  if (!iconFont) {
    fail('Missing Expo MaterialIcons.ttf under app/assets/node_modules/@expo/vector-icons/...');
  }
  ok(`MaterialIcons font (${materialIconsFontRelPath(HOSTING_DIST)})`);
}

async function verifyLive(base) {
  const url = base.replace(/\/$/, '');
  const res = await fetch(`${url}/`);
  const html = await res.text();
  if (res.status < 200 || res.status >= 400) fail(`Live ${url}/ status=${res.status}`);
  if (!/Track today|Facial Age Checker/i.test(html)) fail('Live site missing hero copy');
  ok(`Live ${url}/`);

  const signInRes = await fetch(`${url}/app/sign-in`);
  const signInHtml = await signInRes.text();
  if (signInRes.status < 200 || signInRes.status >= 400) {
    fail(`Live ${url}/app/sign-in status=${signInRes.status}`);
  }
  if (!/<html/i.test(signInHtml)) fail('Live /app/sign-in did not return HTML');
  if (!signInHtml.includes('/favicon.svg')) {
    fail('Live /app/sign-in HTML missing tulip /favicon.svg link');
  }
  ok(`Live ${url}/app/sign-in (tulip favicon)`);

  const faviconRes = await fetch(`${url}/favicon.ico`);
  if (faviconRes.status < 200 || faviconRes.status >= 400) {
    fail(`Live ${url}/favicon.ico status=${faviconRes.status}`);
  }
  const faviconType = faviconRes.headers.get('content-type') || '';
  if (/text\/html/i.test(faviconType)) {
    fail('Live /favicon.ico returned HTML instead of icon');
  }
  ok(`Live ${url}/favicon.ico`);

  const stubRes = await fetch(`${url}/patients/patient-login.html`);
  const stubHtml = await stubRes.text();
  if (!stubHtml.includes('/app/sign-in')) fail('Live patient-login.html missing redirect to /app/sign-in');
  ok(`Live ${url}/patients/patient-login.html stub`);

  const fontRel = materialIconsFontRelPath(HOSTING_DIST);
  if (!fontRel) {
    fail('Local dist missing MaterialIcons.ttf — run npm run build:consumer-hosting before --live verify');
  }
  const fontUrl = `${url}/${fontRel}`;
  const fontRes = await fetch(fontUrl);
  if (fontRes.status < 200 || fontRes.status >= 400) {
    fail(`Live icon font ${fontUrl} status=${fontRes.status}`);
  }
  const fontType = fontRes.headers.get('content-type') || '';
  if (/text\/html/i.test(fontType)) {
    fail(`Live icon font returned HTML instead of font (${fontUrl})`);
  }
  ok(`Live icon font (${fontRel})`);

  const corsRes = await fetch('https://api.callsomo.com/api/patient/verify/send', {
    method: 'OPTIONS',
    headers: {
      Origin: `${url}`,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  if (corsRes.status !== 204) {
    fail(
      `API CORS preflight status=${corsRes.status} (expected 204). ` +
        'Redeploy middleware: gcloud auth login && ./scripts/deploy-to-gcp-production.sh'
    );
  }
  const acao = corsRes.headers.get('access-control-allow-origin') || '';
  if (acao !== url) {
    fail(`API CORS preflight missing allow-origin for ${url} (got: ${acao || 'none'})`);
  }
  ok(`API CORS preflight for ${url}`);

  for (const [label, path] of [
    ['face-read', '/api/public/face-read'],
    ['funnel-match', '/api/public/funnel/match'],
  ]) {
    const pre = await fetch(`https://api.callsomo.com${path}`, {
      method: 'OPTIONS',
      headers: {
        Origin: `${url}`,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    if (pre.status !== 204) {
      fail(`API CORS preflight ${label} status=${pre.status} (expected 204)`);
    }
    ok(`API CORS preflight ${label} for ${url}`);
  }
}

async function main() {
  if (LIVE_BASE) {
    await verifyLive(LIVE_BASE);
  } else {
    await verifyLocalDist();
  }
  console.log('\nConsumer hosting verification passed.\n');
}

main().catch((e) => fail(e.message));
