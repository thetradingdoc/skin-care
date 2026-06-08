#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');
const ASC_ENV = path.join(REPO_ROOT, 'docs', 'password', 'asc.env');
const ASC_EXAMPLE = path.join(REPO_ROOT, 'docs', 'password', 'asc.env.example');
const DEFAULT_KEY = path.join(REPO_ROOT, 'docs', 'password', 'AuthKey_97D48L3W4N.p8');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/\r$/, '');
    if (key) out[key] = value;
  }
  return out;
}

function loadAscEnv() {
  const fromFile = loadEnvFile(ASC_ENV);
  const env = { ...process.env };

  for (const [key, value] of Object.entries(fromFile)) {
    if (value) env[key] = value;
  }

  if (!env.EXPO_ASC_API_KEY_PATH && fs.existsSync(DEFAULT_KEY)) {
    env.EXPO_ASC_API_KEY_PATH = DEFAULT_KEY;
  }
  if (!env.EXPO_ASC_KEY_ID) env.EXPO_ASC_KEY_ID = '97D48L3W4N';
  if (!env.EXPO_APPLE_TEAM_ID) env.EXPO_APPLE_TEAM_ID = '33PP5ZAK59';
  if (!env.EXPO_APPLE_TEAM_TYPE) env.EXPO_APPLE_TEAM_TYPE = 'INDIVIDUAL';

  const missing = [];
  if (!fs.existsSync(env.EXPO_ASC_API_KEY_PATH || '')) {
    missing.push(`EXPO_ASC_API_KEY_PATH (expected ${DEFAULT_KEY})`);
  }
  if (!env.EXPO_ASC_ISSUER_ID || env.EXPO_ASC_ISSUER_ID.includes('paste-issuer-id')) {
    missing.push('EXPO_ASC_ISSUER_ID');
  }

  return { env, missing, ASC_ENV, ASC_EXAMPLE };
}

module.exports = { loadAscEnv, ASC_ENV, ASC_EXAMPLE, DEFAULT_KEY };
