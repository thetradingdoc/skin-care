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

function findExpoWebEntryJs(distRoot) {
  const webDir = path.join(distRoot, 'app', '_expo', 'static', 'js', 'web');
  if (!fs.existsSync(webDir)) return null;
  const match = fs.readdirSync(webDir).find((f) => /^entry-.*\.js$/i.test(f));
  return match ? path.join(webDir, match) : null;
}

function verifyExpoApiBaseInBundle(distRoot, label) {
  const entryJs = findExpoWebEntryJs(distRoot);
  if (!entryJs) {
    fail(`${label}: missing app/_expo/static/js/web/entry-*.js — run npm run build:consumer-hosting`);
  }
  const text = fs.readFileSync(entryJs, 'utf8');
  if (/String\(""\)\.replace\(\/\\\/\$\/, ''\)/.test(text)) {
    fail(
      `${label}: Expo web bundle has empty API_BASE_URL — OTP/sign-in will hit same-origin /api and fail. ` +
        'Rebuild with EXPO_PUBLIC_API_BASE_URL=https://api.callsomo.com'
    );
  }
  if (!text.includes('api.callsomo.com') && !text.includes('api.myskinandcare.com')) {
    fail(
      `${label}: Expo web bundle missing production API host — check EXPO_PUBLIC_API_BASE_URL at build time`
    );
  }
  ok(`${label}: Expo web bundle targets production API`);
}

async function verifyLocalDist() {
  const indexPath = path.join(HOSTING_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail(`Missing ${indexPath}. Run: npm run build:consumer-hosting`);
  }
  const html = fs.readFileSync(indexPath, 'utf8');
  if (!/Skincare Journal|Check your skin/i.test(html)) {
    fail('index.html missing journal positioning hero copy');
  }
  if (!/SoftwareApplication/i.test(html)) {
    fail('index.html missing SoftwareApplication JSON-LD');
  }
  ok('index.html has journal hero + structured data');

  if (!/og:image/i.test(html)) {
    fail('index.html missing og:image meta tag');
  }
  if (!/rel="canonical"/i.test(html)) {
    fail('index.html missing canonical link');
  }
  if (!/twitter:card/i.test(html)) {
    fail('index.html missing twitter:card meta tag');
  }
  ok('index.html has og:image, canonical, twitter:card');

  const ogImagePath = path.join(HOSTING_DIST, 'og-image.jpg');
  if (!fs.existsSync(ogImagePath)) {
    fail('Missing og-image.jpg in bundle root');
  }
  ok('og-image.jpg');

  const contactHtml = fs.readFileSync(path.join(HOSTING_DIST, 'contact.html'), 'utf8');
  if (/Track today\. Glow tomorrow\./i.test(contactHtml)) {
    fail('contact.html still contains banned tagline "Track today. Glow tomorrow."');
  }
  ok('contact.html journal footer tagline');

  const forSlugs = [
    'sensitive-skin',
    'makeup-reactions',
    'derm-visit',
    'dark-skin',
    'flare-tracking',
  ];
  for (const slug of forSlugs) {
    const shellPath = path.join(HOSTING_DIST, 'for', slug, 'index.html');
    if (!fs.existsSync(shellPath)) {
      fail(`Missing for/${slug}/index.html SEO shell`);
    }
    const shellHtml = fs.readFileSync(shellPath, 'utf8');
    const canonical = `https://myskinandcare.com/for/${slug}`;
    if (!shellHtml.includes(`href="${canonical}"`)) {
      fail(`for/${slug}/index.html missing canonical ${canonical}`);
    }
    if (!/<title>[\s\S]*?<\/title>/i.test(shellHtml)) {
      fail(`for/${slug}/index.html missing title`);
    }
    ok(`for/${slug}/index.html SEO shell`);
  }

  for (const seoFile of ['sitemap.xml', 'robots.txt']) {
    const p = path.join(HOSTING_DIST, seoFile);
    if (!fs.existsSync(p)) {
      fail(`Missing ${seoFile}. Ensure skin-care-landing/public/ is in Vite build.`);
    }
    ok(seoFile);
  }

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

  verifyExpoApiBaseInBundle(HOSTING_DIST, 'local dist');

  const firebaseConsumer = path.join(ROOT, 'unified-dashboard', 'firebase.consumer.json');
  if (!fs.existsSync(firebaseConsumer)) {
    fail('Missing unified-dashboard/firebase.consumer.json');
  }
  const hostingCfg = JSON.parse(fs.readFileSync(firebaseConsumer, 'utf8'));
  const rewrites = hostingCfg?.hosting?.rewrites || [];
  const appExact = rewrites.some((r) => r.source === '/app' && r.destination === '/app/index.html');
  const appGlob = rewrites.some((r) => r.source === '/app/**' && r.destination === '/app/index.html');
  if (!appExact || !appGlob) {
    fail(
      'firebase.consumer.json must rewrite /app and /app/** → /app/index.html (SPA cold-boot; TOUCH-002)'
    );
  }
  ok('firebase.consumer.json SPA rewrites for /app + /app/**');

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
  if (!jsText.includes('sensitive-skin')) {
    fail('Landing JS bundle missing /for/sensitive-skin SEO route');
  }
  ok('landing JS includes /for/* SEO routes');

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
  if (!/Skincare Journal|Check your skin/i.test(html)) fail('Live site missing journal hero copy');
  ok(`Live ${url}/`);

  for (const seoPath of ['/sitemap.xml', '/robots.txt']) {
    const seoRes = await fetch(`${url}${seoPath}`);
    if (seoRes.status < 200 || seoRes.status >= 400) {
      fail(`Live ${url}${seoPath} status=${seoRes.status}`);
    }
    ok(`Live ${url}${seoPath}`);
  }

  const forRes = await fetch(`${url}/for/sensitive-skin`);
  const forHtml = await forRes.text();
  if (forRes.status < 200 || forRes.status >= 400) {
    fail(`Live ${url}/for/sensitive-skin status=${forRes.status}`);
  }
  if (!/sensitive skin|Skincare Journal/i.test(forHtml)) {
    fail('Live /for/sensitive-skin missing expected SEO content');
  }
  if (!forHtml.includes('https://myskinandcare.com/for/sensitive-skin')) {
    fail('Live /for/sensitive-skin missing canonical URL in HTML');
  }
  if (!/journal, not another product push|sensitive skin deserves/i.test(forHtml)) {
    fail('Live /for/sensitive-skin missing SEO headline in HTML shell');
  }
  ok(`Live ${url}/for/sensitive-skin`);

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

  const signInPage = await fetch(`${url}/app/sign-in`);
  const signInPageHtml = await signInPage.text();
  const entryMatch = signInPageHtml.match(/\/app\/_expo\/static\/js\/web\/(entry-[^"]+\.js)/);
  if (entryMatch) {
    const entryRes = await fetch(`${url}/app/_expo/static/js/web/${entryMatch[1]}`);
    const entryText = await entryRes.text();
    if (/String\(""\)\.replace\(\/\\\/\$\/, ''\)/.test(entryText)) {
      fail(
        `Live Expo bundle has empty API_BASE_URL — redeploy consumer hosting with ` +
          'EXPO_PUBLIC_API_BASE_URL=https://api.callsomo.com'
      );
    }
    if (!entryText.includes('api.callsomo.com') && !entryText.includes('api.myskinandcare.com')) {
      fail('Live Expo bundle missing production API host');
    }
    ok(`Live Expo bundle targets production API (${entryMatch[1]})`);
  } else {
    console.warn('⚠️  Could not locate live Expo entry bundle — skip API base check');
  }

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
