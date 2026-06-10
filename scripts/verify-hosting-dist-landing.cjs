#!/usr/bin/env node
'use strict';

/**
 * Verify Skin & Care landing hosting bundle (or live site) has expected artifacts.
 *
 * Usage:
 *   node scripts/verify-hosting-dist-landing.cjs
 *   node scripts/verify-hosting-dist-landing.cjs --live https://myskinandcare.com
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOSTING_DIST = path.join(ROOT, 'unified-dashboard', 'hosting-dist');
const LIVE_ARG = process.argv.find((a) => a.startsWith('--live'));
const LIVE_BASE = LIVE_ARG ? process.argv[process.argv.indexOf(LIVE_ARG) + 1] : null;

const HERO_COPY = /Track today|Glow tomorrow|Facial Age Checker/i;
const BRAND_COPY = /Skin\s*&\s*Care/i;

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function findLandingCss(dir) {
  const assetsDir = path.join(dir, 'assets');
  if (!fs.existsSync(assetsDir)) return null;
  const css = fs.readdirSync(assetsDir).filter((f) => /^index-.*\.css$/i.test(f));
  return css.length ? path.join(assetsDir, css[0]) : null;
}

function cssHasSkinCareHero(cssText) {
  return /\.sc-hero-split\b/i.test(cssText) && /\.sc-site-header\b/i.test(cssText);
}

function htmlHasSkinCareCopy(html) {
  return HERO_COPY.test(html) && BRAND_COPY.test(html);
}

async function verifyLocalDist() {
  const emailWordmark = path.join(HOSTING_DIST, 'assets', 'brand', 'email-wordmark.png');
  if (!fs.existsSync(emailWordmark)) {
    fail(`Missing ${emailWordmark}. Run: npm run brand:email-wordmark && node scripts/build-staging-hosting.cjs`);
  }
  ok('email-wordmark.png present in hosting-dist');

  const tulipSvg = path.join(HOSTING_DIST, 'assets', 'brand', 'tulip-mark.svg');
  if (!fs.existsSync(tulipSvg)) {
    fail(`Missing ${tulipSvg}. Run: node scripts/build-staging-hosting.cjs`);
  }
  ok('tulip-mark.svg present in hosting-dist');

  const hero = path.join(HOSTING_DIST, 'assets', 'images', 'hero-glow.jpg');
  if (!fs.existsSync(hero)) {
    fail(`Missing ${hero}. Run: node scripts/build-staging-hosting.cjs`);
  }
  ok('hero-glow.jpg present in hosting-dist');

  const indexPath = path.join(HOSTING_DIST, 'index.html');
  if (!fs.existsSync(indexPath)) {
    fail(`Missing ${indexPath}. Run: node scripts/build-staging-hosting.cjs`);
  }
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (!htmlHasSkinCareCopy(indexHtml)) {
    fail('index.html missing Skin & Care hero copy (expected "Track today" / "Glow tomorrow" + brand name)');
  }
  ok('Skin & Care hero copy present in index.html');

  const cssPath = findLandingCss(HOSTING_DIST);
  if (!cssPath) {
    fail('No index-*.css in hosting-dist/assets');
  }
  const cssText = fs.readFileSync(cssPath, 'utf8');
  if (!cssHasSkinCareHero(cssText)) {
    fail(
      `Skin & Care landing CSS not found in ${path.basename(cssPath)} (expected .sc-hero-split and .sc-site-header)`
    );
  }
  ok(`Skin & Care landing CSS present in ${path.basename(cssPath)}`);
}

async function verifyLive(base) {
  const origin = String(base || '').replace(/\/$/, '');
  if (!origin) fail('--live requires a URL');

  const wordmarkRes = await fetch(`${origin}/assets/brand/email-wordmark.png`, { method: 'HEAD' });
  if (!wordmarkRes.ok) {
    fail(`Live email wordmark ${wordmarkRes.status} ${origin}/assets/brand/email-wordmark.png`);
  }
  ok('Live email wordmark asset 200');

  const tulipRes = await fetch(`${origin}/assets/brand/tulip-mark.svg`, { method: 'HEAD' });
  if (!tulipRes.ok) {
    fail(`Live tulip mark ${tulipRes.status} ${origin}/assets/brand/tulip-mark.svg`);
  }
  ok('Live tulip-mark.svg 200');

  const indexRes = await fetch(`${origin}/`);
  if (!indexRes.ok) fail(`Live index ${indexRes.status}`);
  const html = await indexRes.text();
  if (!htmlHasSkinCareCopy(html)) {
    fail('Live index.html missing Skin & Care hero copy');
  }
  ok('Live Skin & Care hero copy in index.html');

  const cssMatch = html.match(/assets\/(index-[^"]+\.css)/);
  if (!cssMatch) fail('Could not find index-*.css in live index.html');
  const cssUrl = `${origin}/assets/${cssMatch[1]}`;
  const cssRes = await fetch(cssUrl);
  if (!cssRes.ok) fail(`Live CSS ${cssRes.status} ${cssUrl}`);
  const cssText = await cssRes.text();
  if (!cssHasSkinCareHero(cssText)) {
    fail(`Live CSS missing Skin & Care hero styles (${cssMatch[1]}). Hard-refresh or redeploy hosting.`);
  }
  ok(`Live Skin & Care CSS in ${cssMatch[1]}`);
}

async function main() {
  if (LIVE_BASE) {
    await verifyLive(LIVE_BASE);
  } else {
    if (!fs.existsSync(HOSTING_DIST)) {
      fail(`Missing ${HOSTING_DIST}. Run: node scripts/build-staging-hosting.cjs`);
    }
    await verifyLocalDist();
  }
  console.log('\n✅ Hosting landing verification passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
