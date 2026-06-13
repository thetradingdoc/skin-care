#!/usr/bin/env node
'use strict';

/**
 * Ensure hosting-dist-consumer includes conflict-engine routes (scan tab, verdict).
 * Used by playwright.conflict-engine.config.cjs before serving static files.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PATIENT_APP = path.join(ROOT, 'patient-app');
const OUT_APP = path.join(ROOT, 'unified-dashboard', 'hosting-dist-consumer', 'app');
const HOME_HTML = path.join(OUT_APP, '(tabs)', 'home.html');
const TRACK_HTML = path.join(OUT_APP, '(tabs)', 'track.html');
const SCAN_HTML = path.join(OUT_APP, '(tabs)', 'scan.html');
const VERDICT_HTML = path.join(OUT_APP, 'verdict', '[productId].html');

function exists(file) {
  return fs.existsSync(file);
}

function bundleHasLocalhostApiFallback() {
  const jsDir = path.join(OUT_APP, '_expo', 'static', 'js', 'web');
  if (!exists(jsDir)) return false;
  const entries = fs.readdirSync(jsDir).filter((f) => f.startsWith('entry-') && f.endsWith('.js'));
  if (!entries.length) return false;
  const sample = fs.readFileSync(path.join(jsDir, entries[0]), 'utf8');
  return sample.includes('getEffectiveApiBaseUrl');
}

function v3RoutesPresent() {
  return exists(HOME_HTML) && exists(TRACK_HTML) && exists(SCAN_HTML) && exists(VERDICT_HTML);
}

function needsLocalE2eRebuild() {
  if (process.env.PW_FORCE_LOCAL_E2E_API !== '1') return false;
  return !v3RoutesPresent() || !bundleHasLocalhostApiFallback();
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Missing Expo export: ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function main() {
  if (process.env.PW_SKIP_HOSTING_BUILD === '1') {
    console.log('ensure-conflict-engine-hosting: PW_SKIP_HOSTING_BUILD=1 — skipping');
    return;
  }

  if (v3RoutesPresent() && !needsLocalE2eRebuild()) {
    console.log('ensure-conflict-engine-hosting: v3 routes present (home/track/scan/verdict)');
    return;
  }

  if (needsLocalE2eRebuild()) {
    console.log('ensure-conflict-engine-hosting: rebuilding Expo web for local Playwright hosting…');
  } else {
    console.log('ensure-conflict-engine-hosting: exporting Expo web (v3 routes missing)…');
  }
  const apiBase = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
  const env = {
    ...process.env,
    EXPO_PUBLIC_API_BASE_URL: apiBase,
    EXPO_PUBLIC_WEB_SIGNUP_URL: 'https://myskinandcare.com/scan',
  };

  const result = spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
    cwd: PATIENT_APP,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status || 1);

  const expoDist = path.join(PATIENT_APP, 'dist');
  if (!exists(path.join(expoDist, 'index.html'))) {
    console.error(`Expo export failed — no ${expoDist}/index.html`);
    process.exit(1);
  }

  if (fs.existsSync(OUT_APP)) {
    fs.rmSync(OUT_APP, { recursive: true, force: true });
  }
  copyDir(expoDist, OUT_APP);
  console.log(`ensure-conflict-engine-hosting: copied ${expoDist} → ${OUT_APP}`);
}

main();
