#!/usr/bin/env node
'use strict';

/**
 * Assemble Firebase Hosting bundle for myskinandcare.com (consumer only).
 *   - Skin & Care landing SPA (/)
 *   - Marketing static pages (about, contact)
 *   - Patient legal + login shell
 *   - Unified-dashboard assets
 *
 * Usage: node scripts/build-consumer-hosting.cjs
 * Output: unified-dashboard/hosting-dist-consumer/
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const UD = path.join(ROOT, 'unified-dashboard');
const LANDING = path.join(UD, 'skin-care-landing');
const OUT = path.join(UD, 'hosting-dist-consumer');

const API_BASE = (process.env.VITE_API_BASE || 'https://api.myskinandcare.com').replace(/\/$/, '');

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, { merge = false } = {}) {
  if (!fs.existsSync(src)) {
    console.warn(`  skip missing: ${src}`);
    return;
  }
  if (!merge && fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d, { merge: true });
    } else if (!fs.existsSync(d)) {
      copyFile(s, d);
    } else if (merge) {
      /* keep existing */
    } else {
      copyFile(s, d);
    }
  }
}

function main() {
  console.log(`Building skin-care-landing (VITE_API_BASE=${API_BASE})…`);
  const env = { ...process.env, VITE_API_BASE: API_BASE };
  const install = spawnSync('npm', ['ci'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (install.status !== 0) process.exit(install.status || 1);
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: LANDING,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (build.status !== 0) process.exit(build.status || 1);

  console.log('Assembling hosting-dist-consumer…');
  rmrf(OUT);
  mkdirp(OUT);

  copyDir(path.join(LANDING, 'build'), OUT);
  copyDir(path.join(UD, 'assets'), path.join(OUT, 'assets'));
  copyDir(path.join(LANDING, 'build', 'assets'), path.join(OUT, 'assets'), { merge: true });

  for (const page of ['about.html', 'contact.html']) {
    const src = path.join(UD, page);
    if (fs.existsSync(src)) copyFile(src, path.join(OUT, page));
  }

  copyDir(path.join(UD, 'patients', 'legal'), path.join(OUT, 'patients', 'legal'));
  const patientLogin = path.join(UD, 'patients', 'patient-login.html');
  if (fs.existsSync(patientLogin)) {
    copyFile(patientLogin, path.join(OUT, 'patients', 'patient-login.html'));
  }

  if (fs.existsSync(path.join(UD, 'manifest.webmanifest'))) {
    copyFile(path.join(UD, 'manifest.webmanifest'), path.join(OUT, 'manifest.webmanifest'));
  }

  console.log(`\n✅ Consumer hosting bundle: ${OUT}`);
  console.log('   Verify: npm run verify:consumer-hosting');
  console.log('   Deploy: npm run deploy:consumer-hosting');
}

main();
