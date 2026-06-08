#!/usr/bin/env node
'use strict';

/**
 * Smoke test: POST sample JPEG to /api/public/face-read
 *
 * Usage:
 *   node patient-app/scripts/smoke-face-read.cjs
 *   API_BASE_URL=https://api.callsomo.com node patient-app/scripts/smoke-face-read.cjs
 *
 * Requires middleware running with FACE_READ_INFERENCE_BASE_URL set (or expect 503).
 */

const fs = require('fs');
const path = require('path');

const API_BASE = String(process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000').replace(
  /\/$/,
  ''
);

const SAMPLE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
  'base64'
);

async function main() {
  const form = new FormData();
  form.append('image', new Blob([SAMPLE_JPEG], { type: 'image/jpeg' }), 'smoke.jpg');

  const url = `${API_BASE}/api/public/face-read`;
  console.log(`POST ${url}`);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }

  console.log('Status:', res.status);
  console.log(JSON.stringify(json, null, 2));

  if (res.status === 503) {
    console.log('\nHint: set FACE_READ_INFERENCE_BASE_URL in middleware .env or use EXPO_PUBLIC_FACE_READ_MOCK=1 in patient-app/.env');
    process.exit(0);
  }

  if (!res.ok) {
    process.exit(1);
  }

  const age = json?.face_read?.apparent_age_estimate;
  if (age == null) {
    console.warn('Warning: response missing apparent_age_estimate');
  } else {
    console.log(`\nOK — skin age estimate: ${age}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
