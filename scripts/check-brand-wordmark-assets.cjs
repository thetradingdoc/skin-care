#!/usr/bin/env node
'use strict';

/**
 * Guard consumer wordmark assets — landing SSOT, email composite, no legacy logos.
 * Usage: node scripts/check-brand-wordmark-assets.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const violations = [];

const emailLayout = path.join(ROOT, 'middleware-platform/lib/skin-care-email-layout.js');
const emailWordmark = path.join(ROOT, 'unified-dashboard/assets/brand/email-wordmark.png');
const emailWordmark2x = path.join(ROOT, 'unified-dashboard/assets/brand/email-wordmark@2x.png');
const tulipPathJs = path.join(ROOT, 'unified-dashboard/assets/brand/tulip-path.js');
const tulipPathMirror = path.join(ROOT, 'patient-app/lib/tulip-path.js');

const DEPRECATED_ASSETS = [
  'unified-dashboard/assets/images/logo-wordmark.png',
  'unified-dashboard/assets/images/logo-wordmark@2x.png',
  'unified-dashboard/assets/brand/dove-mark.png',
  'unified-dashboard/assets/brand/logo-dove.svg',
  'unified-dashboard/assets/images/logo-dove.svg',
  'unified-dashboard/skin-care-landing/scripts/build-logo-wordmark.py',
  'unified-dashboard/assets/brand/scripts/build-logo-wordmark-portable.py',
];

for (const rel of DEPRECATED_ASSETS) {
  if (fs.existsSync(path.join(ROOT, rel))) {
    violations.push(`Deprecated asset still present: ${rel}`);
  }
}

if (!fs.existsSync(emailWordmark)) {
  violations.push(`Missing ${path.relative(ROOT, emailWordmark)} — run npm run brand:email-wordmark`);
}
if (!fs.existsSync(emailWordmark2x)) {
  violations.push(`Missing ${path.relative(ROOT, emailWordmark2x)} — run npm run brand:email-wordmark`);
}
if (!fs.existsSync(tulipPathJs)) {
  violations.push('Missing unified-dashboard/assets/brand/tulip-path.js');
}
if (!fs.existsSync(tulipPathMirror)) {
  violations.push('Missing patient-app/lib/tulip-path.js mirror');
} else if (fs.existsSync(tulipPathJs)) {
  const ssot = fs.readFileSync(tulipPathJs, 'utf8').replace(/\r\n/g, '\n');
  const mirror = fs.readFileSync(tulipPathMirror, 'utf8').replace(/\r\n/g, '\n');
  const ssotPath = ssot.match(/export const TULIP_PATH\s*=\s*'([^']+)'/);
  const mirrorPath = mirror.match(/export const TULIP_PATH\s*=\s*'([^']+)'/);
  if (!ssotPath || !mirrorPath || ssotPath[1] !== mirrorPath[1]) {
    violations.push('patient-app/lib/tulip-path.js must match unified-dashboard/assets/brand/tulip-path.js');
  }
}

if (fs.existsSync(emailLayout)) {
  const src = fs.readFileSync(emailLayout, 'utf8');
  if (/logo-wordmark\.png/.test(src)) {
    violations.push('skin-care-email-layout.js must not reference deprecated logo-wordmark.png');
  }
  if (/wordmarkHtml|SKIN_CARE_EMAIL_WORDMARK_MODE/.test(src)) {
    violations.push('skin-care-email-layout.js must not use HTML wordmark fallback');
  }
  if (!/email-wordmark\.png/.test(src)) {
    violations.push('skin-care-email-layout.js must reference email-wordmark.png for default header logo');
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'hosting-dist-consumer' ||
        entry.name === 'hosting-dist' ||
        entry.name === '.venv-brand'
      ) {
        continue;
      }
      walk(p, out);
    } else if (/\.(jsx|tsx|js)$/.test(entry.name) && !entry.name.includes('tulip-path')) {
      out.push(p);
    }
  }
  return out;
}

const allowedTulipFiles = new Set([
  path.normalize(tulipPathJs),
  path.normalize(tulipPathMirror),
]);
for (const rootDir of ['unified-dashboard', 'patient-app']) {
  for (const file of walk(path.join(ROOT, rootDir))) {
    if (allowedTulipFiles.has(path.normalize(file))) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/export const TULIP_PATH|const TULIP_PATH\s*=/.test(text) && !/from ['"].*tulip-path/.test(text)) {
      violations.push(
        `${path.relative(ROOT, file)} defines TULIP_PATH locally — import from tulip-path.js`
      );
    }
  }
}

const htmlRoots = [
  path.join(ROOT, 'unified-dashboard'),
  path.join(ROOT, 'middleware-platform/public'),
];
const headerLogoAllow = /checkout-chat|payment-success/;

for (const root of htmlRoots) {
  if (!fs.existsSync(root)) continue;
  function walkHtml(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'hosting-dist-consumer' || entry.name === 'hosting-dist' || entry.name === 'node_modules') continue;
        walkHtml(p);
      } else if (entry.name.endsWith('.html')) {
        const rel = path.relative(ROOT, p);
        if (headerLogoAllow.test(rel)) continue;
        const html = fs.readFileSync(p, 'utf8');
        if (/signup-logo-wordmark|pp-sb-logo-text/.test(html)) {
          violations.push(`${rel} uses deprecated plain-text header logo`);
        }
        if (/logo-panda\.svg/.test(html) && /pp-sb-brand|signup-logo-link|logo-brand/.test(html)) {
          violations.push(`${rel} uses panda in header logo — use sc-logo-wordmark`);
        }
      }
    }
  }
  walkHtml(root);
}

if (violations.length) {
  console.error(`check-brand-wordmark-assets: ${violations.length} violation(s)\n`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log('check-brand-wordmark-assets: OK');
