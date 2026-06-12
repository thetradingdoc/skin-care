#!/usr/bin/env node
'use strict';

/**
 * Local consumer hosting bundle — relative /api URLs (proxied by serve-consumer-hosting).
 * Output: unified-dashboard/hosting-dist-consumer-local/
 *
 * Usage: node scripts/build-consumer-hosting-local.cjs
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const env = {
  ...process.env,
  VITE_API_BASE: '',
  EXPO_PUBLIC_API_BASE_URL: '',
  CONSUMER_HOSTING_OUT: 'hosting-dist-consumer-local',
};

const result = spawnSync(process.execPath, [path.join(__dirname, 'build-consumer-hosting.cjs')], {
  stdio: 'inherit',
  env,
  cwd: ROOT,
});

process.exit(result.status || 0);
