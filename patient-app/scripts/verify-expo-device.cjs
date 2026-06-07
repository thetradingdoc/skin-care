#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envPath = path.join(ROOT, '.env');
const checks = [];

function pass(id, detail) {
  checks.push({ ok: true, id, detail });
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
}

function fail(id, detail) {
  checks.push({ ok: false, id, detail });
  console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
}

if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  const match = env.match(/^EXPO_PUBLIC_API_BASE_URL=(.+)$/m);
  const apiUrl = match?.[1]?.trim();
  if (apiUrl && !apiUrl.startsWith('#')) {
    pass('ENV_API', apiUrl);
  } else {
    fail('ENV_API', 'set EXPO_PUBLIC_API_BASE_URL in patient-app/.env');
  }
} else {
  fail('ENV_FILE', 'copy .env.example to .env and set EXPO_PUBLIC_API_BASE_URL');
}

const apiUrl =
  fs.existsSync(envPath) &&
  fs
    .readFileSync(envPath, 'utf8')
    .match(/^EXPO_PUBLIC_API_BASE_URL=(.+)$/m)?.[1]
    ?.trim();

if (apiUrl && !apiUrl.startsWith('#')) {
  fetch(`${apiUrl.replace(/\/$/, '')}/health/live`)
    .then((r) => {
      if (r.ok) pass('API_HEALTH', `${apiUrl}/health/live`);
      else fail('API_HEALTH', `status ${r.status}`);
      finish();
    })
    .catch((e) => {
      fail('API_HEALTH', e.message);
      finish();
    });
} else {
  finish();
}

function finish() {
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) {
    console.error(`\n${bad.length} issue(s). See docs/runbooks/EXPO_DEVICE.md`);
    process.exit(1);
  }
  console.log('\nReady. On iPhone: install Expo Go, then run npm run start:device');
}
