#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { loadAscEnv } = require('./asc-env.cjs');

const ROOT = path.join(__dirname, '..');
const { env, missing, ASC_ENV, ASC_EXAMPLE } = loadAscEnv();

if (missing.length) {
  console.error('Missing App Store Connect API config:\n');
  for (const item of missing) console.error(`  - ${item}`);
  console.error(`\nCreate ${ASC_ENV} from ${ASC_EXAMPLE}`);
  process.exit(1);
}

let buildId = null;
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg === '--id' && process.argv[i + 1]) {
    buildId = process.argv[i + 1];
    i += 1;
  } else if (arg.startsWith('--id=')) {
    buildId = arg.slice(5);
  }
}
const args = ['eas-cli', 'submit', '--platform', 'ios', '--profile', 'testflight', '--non-interactive'];
if (buildId) {
  args.push('--id', buildId);
} else {
  args.push('--latest');
}

console.log('Submitting to TestFlight with ASC API key');
console.log('Key ID:', env.EXPO_ASC_KEY_ID);
if (env.EXPO_ASC_APP_ID) {
  console.log('App Store Connect app ID:', env.EXPO_ASC_APP_ID);
  env.EXPO_ASC_APP_ID = env.EXPO_ASC_APP_ID;
}

const result = spawnSync('npx', args, { cwd: ROOT, env, stdio: 'inherit' });
process.exit(result.status ?? 1);
