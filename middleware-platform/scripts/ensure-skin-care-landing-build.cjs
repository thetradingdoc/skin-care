#!/usr/bin/env node
'use strict';

/**
 * Ensure unified-dashboard/skin-care-landing/build exists and index.html references a real JS bundle.
 * Used by prestart/predev so http://localhost:4000/ does not serve broken/missing assets.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LANDING = path.join(ROOT, '..', 'unified-dashboard', 'skin-care-landing');
const BUILD_DIR = path.join(LANDING, 'build');
const INDEX_HTML = path.join(BUILD_DIR, 'index.html');

function parseMainBundleSrc(html) {
  const m = String(html).match(
    /<script[^>]+type=["']module["'][^>]+src=["'](\/assets\/index-[^"']+\.js)["']/i
  );
  if (m) return m[1];
  const m2 = String(html).match(/src=["'](\/assets\/index-[^"']+\.js)["']/i);
  return m2 ? m2[1] : null;
}

function landingBuildReady() {
  if (!fs.existsSync(INDEX_HTML)) return false;
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const src = parseMainBundleSrc(html);
  if (!src || src.includes('/src/')) return false;
  const bundlePath = path.join(BUILD_DIR, src.replace(/^\//, ''));
  return fs.existsSync(bundlePath) && fs.statSync(bundlePath).isFile();
}

function runBuild() {
  console.log('[ensure-skin-care-landing-build] Building skin-care-landing…');
  const env = { ...process.env };
  const install = spawnSync('npm', ['ci'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32'
  });
  if (install.status !== 0) {
    console.error('[ensure-skin-care-landing-build] npm ci failed in skin-care-landing');
    process.exit(install.status || 1);
  }
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32'
  });
  if (build.status !== 0) {
    console.error('[ensure-skin-care-landing-build] npm run build failed in skin-care-landing');
    process.exit(build.status || 1);
  }
}

function main() {
  if (landingBuildReady()) {
    console.log('[ensure-skin-care-landing-build] OK — skin-care-landing/build is ready');
    return;
  }
  if (!fs.existsSync(path.join(LANDING, 'package.json'))) {
    console.error('[ensure-skin-care-landing-build] skin-care-landing package.json not found:', LANDING);
    process.exit(1);
  }
  runBuild();
  if (!landingBuildReady()) {
    console.error(
      '[ensure-skin-care-landing-build] Build finished but index.html or main bundle is still missing/invalid'
    );
    process.exit(1);
  }
  console.log('[ensure-skin-care-landing-build] Build completed successfully');
}

main();
