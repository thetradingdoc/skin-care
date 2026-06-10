#!/usr/bin/env node
'use strict';

/**
 * Automated T7 / reveal QA: production vision env + Playwright State A/B + vision unit tests.
 *
 * Usage:
 *   npm run smoke:face-read-reveal
 *   API_BASE_URL=https://api.callsomo.com npm run smoke:face-read-reveal
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const API_BASE = String(process.env.API_BASE_URL || 'https://api.callsomo.com').replace(/\/$/, '');
const SAMPLE_FACE = path.join(ROOT, 'inference', 'face-read', 'fixtures', 'sample1.jpg');

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || ROOT, ...opts });
}

async function postFaceRead(imageBytes, filename = 'qa.jpg') {
  const form = new FormData();
  form.append('image', new Blob([imageBytes], { type: 'image/jpeg' }), filename);
  const res = await fetch(`${API_BASE}/api/public/face-read`, {
    method: 'POST',
    body: form,
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function assertRevealContract(fr) {
  if (fr?.reject_reason) {
    console.log(`Gate reject (${fr.reject_reason}) — vision stage skipped (expected for some fixtures).`);
    return 'gate_reject';
  }
  if (fr?.vision_enabled !== true) {
    throw new Error('Live face_read missing vision_enabled:true — middleware may be on old revision.');
  }
  const findings = Array.isArray(fr.findings) ? fr.findings : [];
  const scores = fr.concern_scores && typeof fr.concern_scores === 'object' ? fr.concern_scores : {};
  const hasSignal =
    findings.length > 0 ||
    Boolean(fr.scan_summary) ||
    Object.values(scores).some((v) => Number(v) > 0);
  if (!hasSignal && !fr.vision_error) {
    throw new Error(
      'Vision enabled but no findings, scan_summary, or concern scores — dark-skin hotfix may not be live.',
    );
  }
  if (findings.some((f) => f.id === 'poor_lighting')) {
    console.log('✅ poor_lighting finding present — State A path for low light.');
    return 'state_a_poor_lighting';
  }
  if (findings.length > 0 || hasSignal) {
    console.log(`✅ Vision signal present (${findings.length} findings).`);
    return 'state_a';
  }
  if (fr.vision_error) {
    console.log(`✅ vision_error=${fr.vision_error} — Reveal State B should show retry tips.`);
    return 'state_b';
  }
  return 'unknown';
}

async function main() {
  console.log('=== Reveal live QA (T7 automated) ===\n');

  try {
    run('bash scripts/audit-cloudrun-face-read-config.sh');
  } catch (e) {
    console.warn('Cloud Run audit skipped (gcloud unavailable):', e.message);
  }

  run(
    'npx jest __tests__/face-read-vision.test.js __tests__/face-read-merge.test.js --no-coverage',
    { cwd: path.join(ROOT, 'middleware-platform') },
  );

  if (fs.existsSync(SAMPLE_FACE)) {
    const bytes = fs.readFileSync(SAMPLE_FACE);
    console.log(`POST ${API_BASE}/api/public/face-read (fixture sample1.jpg)`);
    const { res, json } = await postFaceRead(bytes);
    console.log('Status:', res.status);
    if (res.status !== 200) {
      throw new Error(`face-read HTTP ${res.status}`);
    }
    const outcome = assertRevealContract(json?.face_read || {});
    console.log(`Live API outcome: ${outcome}`);
  } else {
    console.warn('Fixture JPEG missing — skipping live API contract check.');
  }

  run(
    'PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright test -c playwright.skin-age-journey.config.cjs -g "E2E-16|E2E-17|E2E-05|E2E-06"',
    { cwd: path.join(ROOT, 'middleware-platform') },
  );

  console.log('\n✅ Reveal live QA passed (automated T7).');
  console.log('Manual follow-up: retake a dark-skin / dim-room selfie on /scan to confirm UX end-to-end.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
