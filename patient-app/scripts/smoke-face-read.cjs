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

const SAMPLE_FACE = path.join(__dirname, '..', '..', 'inference', 'face-read', 'fixtures', 'sample1.jpg');

const API_BASE = String(process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000').replace(
  /\/$/,
  ''
);

const SAMPLE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==',
  'base64'
);

async function postFaceRead(imageBytes, filename = 'smoke.jpg') {
  const form = new FormData();
  form.append('image', new Blob([imageBytes], { type: 'image/jpeg' }), filename);
  const url = `${API_BASE}/api/public/face-read`;
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
  return { res, json };
}

async function main() {
  const imageBytes = fs.existsSync(SAMPLE_FACE)
    ? fs.readFileSync(SAMPLE_FACE)
    : SAMPLE_JPEG;
  const url = `${API_BASE}/api/public/face-read`;
  console.log(`POST ${url}`);

  const { res, json } = await postFaceRead(imageBytes);
  console.log('Status:', res.status);
  console.log(JSON.stringify(json, null, 2));

  if (res.status === 503) {
    console.log('\nHint: set FACE_READ_INFERENCE_BASE_URL on Cloud Run (npm run configure:face-read-inference)');
    console.log('      See docs/runbooks/FACE_READ_INFERENCE.md');
    process.exit(1);
  }

  if (!res.ok) {
    process.exit(1);
  }

  const fr = json?.face_read;
  if (fr?.reject_reason) {
    console.warn(`Warning: sample image rejected (${fr.reject_reason}) — gate is working; use a closer selfie for age smoke.`);
    console.log(`Reject message: ${fr.user_message || fr.reject_reason}`);
  } else {
    const age = fr?.apparent_age_estimate;
    const modelId = fr?.model_id;
    if (age == null || !modelId || modelId === 'mock' || modelId === 'fallback_mock') {
      console.warn('Warning: response missing live inference fields (apparent_age_estimate + model_id)');
      process.exit(1);
    }

    const findings = Array.isArray(fr?.findings) ? fr.findings : [];
    const concernKeys = fr?.concern_scores ? Object.keys(fr.concern_scores) : [];
    if (process.env.FACE_READ_VISION_ENABLED === '1') {
      if (!findings.length && !concernKeys.length) {
        console.warn('Warning: vision enabled but no findings/concern_scores in response');
      } else {
        console.log(`Findings: ${findings.length}, concern keys: ${concernKeys.join(', ') || 'none'}`);
      }
    } else {
      console.log('Vision off — findings optional (enable FACE_READ_VISION_ENABLED=1 for GPT stage)');
    }

    if (fr?.zone_polygons && Object.keys(fr.zone_polygons).length) {
      console.log(`Zone polygons: ${Object.keys(fr.zone_polygons).join(', ')}`);
    }

    console.log(`\nOK — skin age estimate: ${age} (model: ${modelId})`);
  }

  console.log('\nReject gate smoke (tiny JPEG, expect 200 + reject_reason)...');
  const reject = await postFaceRead(SAMPLE_JPEG, 'reject-smoke.jpg');
  const rfr = reject.json?.face_read;
  if (reject.res.status === 200 && rfr?.reject_reason) {
    console.log(`OK — reject_reason: ${rfr.reject_reason}`);
  } else if (reject.res.status === 422) {
    console.log('OK — 422 on decode/no-face tiny image (legacy path)');
  } else {
    console.warn('Warning: expected gate reject on tiny JPEG');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
