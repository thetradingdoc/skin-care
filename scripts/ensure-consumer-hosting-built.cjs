#!/usr/bin/env node
'use strict';

/**
 * Build hosting-dist-consumer only when verify-consumer-hosting fails.
 * Avoids redundant Expo exports during verify-prod-ready (EMFILE on macOS).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const verify = spawnSync(process.execPath, [path.join(__dirname, 'verify-consumer-hosting.cjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});

if (verify.status === 0) {
  console.log('ensure-consumer-hosting-built: bundle OK — skip rebuild');
  process.exit(0);
}

console.log('ensure-consumer-hosting-built: rebuilding consumer hosting…');
const build = spawnSync('npm', ['run', 'build:consumer-hosting'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
});
process.exit(build.status || 0);
