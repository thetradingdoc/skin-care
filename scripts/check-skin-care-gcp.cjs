#!/usr/bin/env node
'use strict';

/**
 * Verify Skin & Care consumer stack (myskinandcare.com + api.myskinandcare.com).
 * Usage:
 *   npm run gcp:skin-care:check
 *   UI_BASE_URL=https://myskinandcare.com MIDDLEWARE_API_BASE=https://api.myskinandcare.com npm run gcp:skin-care:check
 */

const UI = (process.env.UI_BASE_URL || 'https://myskinandcare.com').replace(/\/$/, '');
const API = (process.env.MIDDLEWARE_API_BASE || 'https://api.myskinandcare.com').replace(/\/$/, '');

async function fetchPage(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    return { status: res.status, ct: res.headers.get('content-type') || '', text };
  } catch (e) {
    return { status: 0, error: e.message, text: '' };
  }
}

function ok(id, detail) {
  console.log(`PASS ${id} — ${detail}`);
  return true;
}

function fail(id, detail) {
  console.error(`FAIL ${id} — ${detail}`);
  return false;
}

async function main() {
  console.log('\nSkin & Care GCP consumer check\n');
  console.log(`  UI:  ${UI}`);
  console.log(`  API: ${API}\n`);

  let all = true;

  const ui = await fetchPage(`${UI}/`);
  all =
    (ui.status >= 200 && ui.status < 400 && /Track today|Facial Age Checker/i.test(ui.text)
      ? ok
      : fail)('UI_LANDING', `status=${ui.status}`) && all;

  const scan = await fetchPage(`${UI}/scan`);
  all = (scan.status >= 200 && scan.status < 400 ? ok : fail)('UI_SCAN_ROUTE', `status=${scan.status}`) && all;

  const about = await fetchPage(`${UI}/about.html`);
  all = (about.status >= 200 && about.status < 400 ? ok : fail)('UI_ABOUT', `status=${about.status}`) && all;

  const privacy = await fetchPage(`${UI}/patients/legal/privacy.html`);
  all =
    (privacy.status >= 200 && privacy.status < 400 ? ok : fail)(
      'UI_PRIVACY',
      `status=${privacy.status}`
    ) && all;

  const apiHealth = await fetchPage(`${API}/health/live`);
  all =
    (apiHealth.status >= 200 && apiHealth.status < 300 ? ok : fail)(
      'API_HEALTH_LIVE',
      `status=${apiHealth.status}`
    ) && all;

  const apiBase = await fetchPage(`${UI}/assets/js/api-base.js`);
  const apiBaseOk =
    apiBase.status >= 200 &&
    apiBase.status < 400 &&
    apiBase.text.includes('api.myskinandcare.com');
  all =
    (apiBaseOk ? ok : fail)(
      'UI_API_BASE_JS',
      apiBaseOk ? 'api-base.js → api.myskinandcare.com' : `status=${apiBase.status}`
    ) && all;

  console.log('');
  if (all) {
    console.log('Skin & Care consumer check passed.\n');
    process.exit(0);
  }
  console.error('Skin & Care consumer check failed (DNS may still be propagating).\n');
  process.exit(1);
}

main();
