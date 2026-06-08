#!/usr/bin/env node
'use strict';

/**
 * Pre-build checklist for TestFlight — prints blockers and exact next commands.
 * Does not call Apple APIs (unlock status must be checked in Safari).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function has(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function section(title) {
  console.log(`\n## ${title}`);
}

console.log('Skin & Care — TestFlight doctor\n');

section('1. Expo (EAS)');
try {
  const who = execSync('npx eas-cli whoami', { cwd: ROOT, encoding: 'utf8' }).trim();
  console.log(`OK  Logged in as: ${who}`);
} catch {
  console.log('FAIL  Run: npx eas-cli login');
}

try {
  const out = execSync('npx eas-cli build:list --platform ios --limit 1 --json --non-interactive', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const builds = JSON.parse(out || '[]');
  if (builds.length) {
    const b = builds[0];
    console.log(`OK  Latest iOS build: ${b.status} (${b.id})`);
    if (b.status === 'FINISHED') {
      console.log('    Next: npm run submit:testflight');
    }
  } else {
    console.log('WARN  No iOS builds on EAS yet — run build:testflight after Apple login works');
  }
} catch {
  console.log('WARN  Could not list EAS builds (run npm run verify:testflight)');
}

section('2. Apple Developer (manual — common blocker)');
console.log(`
If build failed with error -20209 ("account locked"):
  1. https://iforgot.apple.com — unlock / reset password
  2. https://appleid.apple.com — confirm you can sign in in Safari
  3. App-Specific Password: Sign-In and Security → generate label "EAS Build"
  4. Use FULL Apple ID email (not username) when EAS prompts

Team ID for this project: 33PP5ZAK59
Bundle ID: com.skinandcare.app
`);

const appleId = process.env.EXPO_APPLE_ID;
const applePass = process.env.EXPO_APPLE_APP_SPECIFIC_PASSWORD || process.env.EXPO_APPLE_PASSWORD;
if (appleId && applePass) {
  console.log('OK  EXPO_APPLE_ID + app-specific password set in shell (non-interactive build possible)');
} else {
  console.log(`Optional — set before build to avoid password prompts:
  export EXPO_APPLE_ID="your-apple-id@email.com"
  export EXPO_APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
  export EXPO_APPLE_TEAM_ID="33PP5ZAK59"
`);
}

section('3. Build + submit commands (run from patient-app/)');
console.log(`
npm run verify:testflight
npm run build:testflight

# Or build and upload to TestFlight in one step:
npx eas-cli build --platform ios --profile testflight --auto-submit

# After a finished build only:
npm run submit:testflight
`);

section('4. App Store Connect (after upload)');
console.log(`
TestFlight tab → wait for Processing → Internal Testing → add your Apple ID email
Install Apple TestFlight app on iPhone → accept invite → install Skin & Care
`);

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
if (appJson.expo?.extra?.eas?.projectId) {
  console.log(`EAS project: https://expo.dev/accounts/skinandcare/projects/${appJson.expo.slug}/builds`);
} else {
  console.log('FAIL  Missing eas.projectId — run: npx eas-cli init');
}

if (!has('node')) {
  console.log('\nFAIL  Node.js required');
  process.exit(1);
}
