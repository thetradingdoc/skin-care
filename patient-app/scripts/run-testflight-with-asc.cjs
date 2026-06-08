#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { loadAscEnv } = require('./asc-env.cjs');

const ROOT = path.join(__dirname, '..');
const { env, missing, ASC_ENV, ASC_EXAMPLE } = loadAscEnv();

if (missing.length) {
  console.error('Missing App Store Connect API config:\n');
  for (const item of missing) console.error(`  - ${item}`);
  console.error(`\nCreate ${ASC_ENV} from ${ASC_EXAMPLE}`);
  process.exit(1);
}

const nonInteractive = process.argv.includes('--non-interactive');
const args = ['eas-cli', 'build', '--platform', 'ios', '--profile', 'testflight'];
if (nonInteractive) args.push('--non-interactive');

console.log('Using ASC API key:', env.EXPO_ASC_API_KEY_PATH);
console.log('Key ID:', env.EXPO_ASC_KEY_ID);
console.log('Issuer ID:', env.EXPO_ASC_ISSUER_ID.slice(0, 8) + '…');
console.log('Running: eas build (no auto-submit — run submit:testflight:asc after)\n');

const result = spawnSync('npx', args, { cwd: ROOT, env, stdio: 'inherit' });
process.exit(result.status ?? 1);
