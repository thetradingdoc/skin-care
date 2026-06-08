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
    'patients/legal/privacy.html',
    'assets/js/api-base.js',
  ]) {
    const p = path.join(HOSTING_DIST, rel);
    if (!fs.existsSync(p)) fail(`Missing ${rel}`);
    ok(rel);
  }

  const apiBase = fs.readFileSync(path.join(HOSTING_DIST, 'assets/js/api-base.js'), 'utf8');
  if (!apiBase.includes('api.myskinandcare.com')) {
    fail('api-base.js should default to api.myskinandcare.com');
  }
  ok('api-base.js → api.myskinandcare.com');

  const assetsDir = path.join(HOSTING_DIST, 'assets');
  const js = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.js$/i.test(f));
  if (!js.length) fail('No landing JS bundle in assets/');
  const jsText = fs.readFileSync(path.join(assetsDir, js[0]), 'utf8');
  if (!jsText.includes('api.myskinandcare.com') && !jsText.includes('/api/public')) {
    console.warn('⚠️  Landing JS may not embed VITE_API_BASE — confirm production build env');
  } else {
    ok('landing JS bundle present');
  }
}

async function verifyLive(base) {
  const url = base.replace(/\/$/, '');
  const res = await fetch(`${url}/`);
  const html = await res.text();
  if (res.status < 200 || res.status >= 400) fail(`Live ${url}/ status=${res.status}`);
  if (!/Track today|Facial Age Checker/i.test(html)) fail('Live site missing hero copy');
  ok(`Live ${url}/`);
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
