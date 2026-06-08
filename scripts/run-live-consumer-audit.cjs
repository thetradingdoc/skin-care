#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HOSTS = [
  'https://myskinandcare.com',
  'https://www.myskinandcare.com',
  'https://callsomo.com',
  'https://www.callsomo.com',
];

let failed = 0;
console.log('\nLive consumer Playwright audit\n');

for (const host of HOSTS) {
  console.log(`\n--- ${host} ---\n`);
  const r = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      'e2e/live-consumer-audit.spec.cjs',
      '--config',
      'playwright.live-consumer.config.cjs',
    ],
    {
      cwd: path.join(ROOT, 'middleware-platform'),
      stdio: 'inherit',
      env: { ...process.env, LIVE_BASE_URL: host },
      shell: process.platform === 'win32',
    }
  );
  if (r.status !== 0) failed += 1;
}

console.log(`\n${failed ? 'FAIL' : 'PASS'}: ${HOSTS.length - failed}/${HOSTS.length} hosts passed\n`);
process.exit(failed ? 1 : 0);
