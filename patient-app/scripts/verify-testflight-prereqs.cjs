#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const appJsonPath = path.join(ROOT, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const expo = appJson.expo || {};

const checks = [];

function pass(id, detail) {
  checks.push({ ok: true, id, detail });
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
}

function fail(id, detail) {
  checks.push({ ok: false, id, detail });
  console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
}

function hasCmd(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (expo.ios?.bundleIdentifier === 'com.skinandcare.app') {
  pass('BUNDLE_ID', 'com.skinandcare.app');
} else {
  fail('BUNDLE_ID', `expected com.skinandcare.app, got ${expo.ios?.bundleIdentifier}`);
}

if (fs.existsSync(path.join(ROOT, 'assets/images/icon.png'))) {
  pass('APP_ICON', 'assets/images/icon.png');
} else {
  fail('APP_ICON', 'missing assets/images/icon.png');
}

const projectId = expo.extra?.eas?.projectId;
if (projectId) {
  pass('EAS_PROJECT', projectId);
} else {
  fail('EAS_PROJECT', 'run: npx eas init (links Expo project, writes extra.eas.projectId to app.json)');
}

if (hasCmd('node')) pass('NODE', process.version);
else fail('NODE', 'Node.js required');

try {
  execSync('npm test', { cwd: ROOT, stdio: 'pipe' });
  pass('UNIT_TESTS', 'vitest');
} catch {
  fail('UNIT_TESTS', 'run npm test in patient-app');
}

try {
  execSync('npx eas-cli --version', { cwd: ROOT, stdio: 'pipe' });
  pass('EAS_CLI', 'available via npx eas-cli');
} catch {
  fail('EAS_CLI', 'install: npm i -g eas-cli OR use npx eas-cli');
}

try {
  execSync('npx eas-cli whoami', { cwd: ROOT, stdio: 'pipe' });
  pass('EAS_LOGIN', 'logged in');
} catch {
  fail('EAS_LOGIN', 'run: npx eas login');
}

const apiOk = process.env.SKIP_API_CHECK === '1';
if (apiOk) {
  pass('API_HEALTH', 'skipped (SKIP_API_CHECK=1)');
} else {
  const apiHealthUrl = (process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.callsomo.com').replace(
    /\/$/,
    ''
  );
  fetch(`${apiHealthUrl}/health/live`)
    .then((r) => {
      if (r.ok) pass('API_HEALTH', `${apiHealthUrl}/health/live`);
      else fail('API_HEALTH', `status ${r.status}`);
      finish();
    })
    .catch((e) => {
      fail('API_HEALTH', e.message);
      finish();
    });
  return;
}

finish();

function finish() {
  const bad = checks.filter((c) => !c.ok);
  if (bad.length) {
    console.error(`\n${bad.length} prerequisite(s) missing. See docs/runbooks/TESTFLIGHT.md`);
    process.exit(1);
  }
  console.log('\nAll TestFlight prerequisites OK. Next: npm run build:testflight');
}
