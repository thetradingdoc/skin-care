#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { loadAscEnv } = require('./asc-env.cjs');

const BUNDLE_ID = 'com.skinandcare.app';

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeAscToken(keyPath, keyId, issuerId) {
  const privateKey = fs.readFileSync(keyPath, 'utf8');
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })
  );
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  const sig = signature
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${unsigned}.${sig}`;
}

async function main() {
  const { env, missing } = loadAscEnv();
  if (missing.length) {
    console.error('Missing ASC config:', missing.join(', '));
    process.exit(1);
  }

  const token = makeAscToken(env.EXPO_ASC_API_KEY_PATH, env.EXPO_ASC_KEY_ID, env.EXPO_ASC_ISSUER_ID);
  const url = `https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('ASC API error', res.status, JSON.stringify(body, null, 2));
    process.exit(1);
  }
  const appId = body?.data?.[0]?.id;
  const name = body?.data?.[0]?.attributes?.name;
  if (!appId) {
    console.error(`No app found for bundle ${BUNDLE_ID}. Create it in App Store Connect first.`);
    process.exit(1);
  }
  console.log(appId);
  if (name) console.error(`App: ${name}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
