#!/usr/bin/env node
'use strict';

/**
 * verify:touche-prod-capture — standing pre-deploy / pre-TestFlight gate.
 *
 * Probes LIVE production (default https://api.callsomo.com). Fails loudly when
 * medical-tracker capture chain cannot work for a real tester.
 *
 * Usage:
 *   node middleware-platform/scripts/verify-touche-prod-capture.cjs
 *   API_BASE=https://api.callsomo.com node middleware-platform/scripts/verify-touche-prod-capture.cjs
 *   TOUCHE_PROD_OTP_EMAIL=you@example.com node …   # OTP send probe (side effect)
 *   SKIP_OTP=1 node …                              # skip email side effect
 *
 * Privileged extras (optional, when gcloud is authenticated):
 *   VERIFY_GCLOUD=1 CLOUDRUN_SERVICE=somo-middleware CLOUDRUN_REGION=us-central1 \
 *     GCP_PROJECT=somo-callsomo node …
 *
 * Exit 0 only if all critical checks pass.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = String(process.env.API_BASE || process.env.PLAYWRIGHT_BASE_URL || 'https://api.callsomo.com')
  .trim()
  .replace(/\/$/, '');
const SKIP_OTP = process.env.SKIP_OTP === '1';
const OTP_EMAIL = String(process.env.TOUCHE_PROD_OTP_EMAIL || '').trim();
const VERIFY_GCLOUD = process.env.VERIFY_GCLOUD === '1';
const OUT_DIR =
  process.env.TOUCHE_PROD_EVIDENCE_DIR ||
  path.join(__dirname, '..', '..', 'todos', 'pending', `touche-prod-gate-${new Date().toISOString().slice(0, 10)}`);

const results = [];

function note(id, status, detail, evidence) {
  results.push({ id, status, detail, evidence: evidence || null, at: new Date().toISOString() });
  const mark = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : '✗';
  console.log(`${mark} [${status}] ${id}: ${detail}`);
  if (evidence && typeof evidence === 'string' && evidence.length < 400) {
    console.log(`    evidence: ${evidence}`);
  } else if (evidence && typeof evidence === 'object') {
    console.log(`    evidence: ${JSON.stringify(evidence).slice(0, 400)}`);
  }
}

async function httpJson(method, urlPath, opts = {}) {
  const url = urlPath.startsWith('http') ? urlPath : `${API_BASE}${urlPath}`;
  const headers = { ...(opts.headers || {}) };
  let body = opts.body;
  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(opts.timeoutMs || 60000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, text: text.slice(0, 4000), json, url };
}

function minimalJpegBuffer() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
    'base64',
  );
}

async function multipart(urlPath, fields, fileField) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields || {})) form.append(k, String(v));
  if (fileField) {
    const blob = new Blob([fileField.buffer], { type: fileField.type || 'image/jpeg' });
    form.append(fileField.name || 'file', blob, fileField.filename || 'probe.jpg');
  }
  return httpJson('POST', urlPath, { body: form, timeoutMs: 90000 });
}

function gcloudEnvNames() {
  const service = process.env.CLOUDRUN_SERVICE || 'somo-middleware';
  const region = process.env.CLOUDRUN_REGION || 'us-central1';
  const project = process.env.GCP_PROJECT || 'somo-callsomo';
  const r = spawnSync(
    'gcloud',
    [
      'run',
      'services',
      'describe',
      service,
      `--region=${region}`,
      `--project=${project}`,
      '--format=json(spec.template.spec.containers[0].env)',
    ],
    { encoding: 'utf8', timeout: 60000 },
  );
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || r.stdout || 'gcloud failed').slice(0, 500) };
  }
  let parsed;
  try {
    parsed = JSON.parse(r.stdout || '{}');
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const envList = parsed?.spec?.template?.spec?.containers?.[0]?.env || parsed || [];
  const names = new Set();
  const values = {};
  for (const row of Array.isArray(envList) ? envList : []) {
    if (row && row.name) {
      names.add(row.name);
      if (row.value != null) values[row.name] = String(row.value);
      if (row.valueFrom) values[row.name] = '[secretRef]';
    }
  }
  return { ok: true, names, values };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Touche prod capture gate → ${API_BASE}`);
  console.log(`Evidence dir: ${OUT_DIR}\n`);

  // 0. Health
  const health = await httpJson('GET', '/health');
  if (health.status === 200 && health.json?.status === 'ok') {
    note('health', 'PASS', 'API /health ok', health.json);
  } else {
    note('health', 'FAIL', `API unhealthy HTTP ${health.status}`, health.text.slice(0, 200));
  }

  // Medical-tracker route presence (blocker for capture SSOT)
  const routeProbes = [
    ['GET', '/api/patient/records/calendar'],
    ['GET', '/api/patient/progress/aggregates'],
    ['GET', '/api/patient/marks'],
    ['GET', '/api/patient/ai/usage'],
    ['GET', '/api/patient/export/physician.pdf'],
  ];
  let medicalRoutesPresent = true;
  for (const [method, p] of routeProbes) {
    const r = await httpJson(method, p);
    // 401/403 = mounted but auth required; 404 = not deployed
    if (r.status === 404 || (r.json && r.json.error === 'Endpoint not found')) {
      medicalRoutesPresent = false;
      note(`route:${p}`, 'FAIL', `Not mounted on prod (HTTP ${r.status})`, r.json || r.text.slice(0, 160));
    } else if (r.status === 401 || r.status === 403) {
      note(`route:${p}`, 'PASS', `Mounted (auth gate HTTP ${r.status})`, r.json || r.text.slice(0, 120));
    } else if (r.status >= 200 && r.status < 500) {
      note(`route:${p}`, 'PASS', `Mounted (HTTP ${r.status})`, r.json || r.text.slice(0, 120));
    } else {
      medicalRoutesPresent = false;
      note(`route:${p}`, 'FAIL', `Unexpected HTTP ${r.status}`, r.text.slice(0, 160));
    }
  }

  // 1. ClamAV / capture AV — only if anonymous or capture exists
  const jpeg = minimalJpegBuffer();
  const today = new Date().toISOString().slice(0, 10);
  const anon = await multipart(
    '/api/patient/records/anonymous',
    {
      tag: 'other',
      ai_or_manual: 'manual',
      request_id: `prod-gate-${Date.now()}`,
      structured_json: JSON.stringify({ date: today, label: 'prod-gate-probe' }),
    },
    { name: 'file', buffer: jpeg, type: 'image/jpeg', filename: 'probe.jpg' },
  );
  if (anon.status === 404 || anon.json?.error === 'Endpoint not found') {
    note(
      'clamav',
      'FAIL',
      'Cannot probe AV: /api/patient/records/anonymous not deployed (404). Medical capture stack absent on this API host.',
      anon.json,
    );
  } else if (anon.json?.error_code === 'AV_NOT_CONFIGURED' || anon.text.includes('AV_NOT_CONFIGURED')) {
    note('clamav', 'FAIL', 'ClamAV not configured in prod — medical uploads fail-closed', anon.json || anon.text.slice(0, 300));
  } else if (anon.json?.error_code === 'AV_SCAN_BLOCKED' || anon.json?.error_code === 'AV_SCAN_ERROR') {
    note('clamav', 'WARN', `ClamAV path responded with ${anon.json.error_code} (configured but scan outcome failed)`, anon.json);
  } else if (anon.status >= 200 && anon.status < 300 && anon.json?.success !== false) {
    note('clamav', 'PASS', 'Anonymous capture accepted (AV did not fail-closed as AV_NOT_CONFIGURED)', {
      status: anon.status,
      media: anon.json?.fact?.media_uri || anon.json?.media_uri || anon.json?.fact?.id,
    });
    // 2. Durable media — inspect URI scheme if present
    const mediaUri =
      anon.json?.fact?.storage_ref ||
      anon.json?.fact?.media_uri ||
      anon.json?.media_uri ||
      anon.json?.fact?.structured?.media_uri ||
      '';
    const storageProvider = anon.json?.fact?.storage_provider;
    if (storageProvider === 'gcs' || String(mediaUri).startsWith('gs://')) {
      note('media', 'PASS', `Durable GCS media observed`, {
        storage_provider: storageProvider,
        storage_ref: mediaUri ? String(mediaUri).slice(0, 120) : null,
        media_url: anon.json?.fact?.media_url || null,
      });
    } else if (!mediaUri && storageProvider && storageProvider !== 'local') {
      note('media', 'PASS', `Durable media provider=${storageProvider} (opaque ref)`, {
        storage_provider: storageProvider,
        media_url: anon.json?.fact?.media_url || null,
      });
    } else if (!mediaUri) {
      note('media', 'WARN', 'Capture ok but no media_uri in response — cannot confirm Azure vs local://', anon.json);
    } else if (String(mediaUri).startsWith('local://') || storageProvider === 'local') {
      note('media', 'FAIL', `Prod media landed on ephemeral local:// → ${mediaUri}`, { mediaUri, storageProvider });
    } else if (/^(azure|https|gs|s3):\/\//i.test(String(mediaUri)) || String(mediaUri).includes('blob.core.windows.net')) {
      note('media', 'PASS', `Durable media URI scheme observed`, { mediaUri: String(mediaUri).slice(0, 120) });
    } else {
      note('media', 'WARN', `Unrecognized media URI scheme`, { mediaUri: String(mediaUri).slice(0, 160), storageProvider });
    }
  } else if (anon.status === 401 || anon.status === 403) {
    note('clamav', 'WARN', `Capture requires auth (HTTP ${anon.status}) — AV not exercised anonymously`, anon.json);
    note('media', 'WARN', 'Skipped — no anonymous capture', null);
  } else {
    note('clamav', 'FAIL', `Unexpected capture response HTTP ${anon.status}`, anon.json || anon.text.slice(0, 300));
    note('media', 'FAIL', 'Skipped — capture failed', null);
  }

  // 3. Encryption key — privileged gcloud; report which env the runtime fallthrough would resolve from
  if (VERIFY_GCLOUD) {
    const env = gcloudEnvNames();
    if (!env.ok) {
      note('encryption_key', 'FAIL', `gcloud describe failed: ${env.error}`, null);
    } else {
      const order = [
        'PATIENT_RECORD_FACTS_ENCRYPTION_KEY',
        'BILLING_DATA_ENCRYPTION_KEY',
        'SESSION_SECRET',
      ];
      let resolvedFrom = 'literal:dev-billing-key';
      let valueKind = 'hardcoded_fallback';
      for (const name of order) {
        if (!env.names.has(name)) continue;
        const val = env.values[name];
        if (val === '' || val === '[empty]') continue;
        resolvedFrom = name;
        if (val === 'dev-billing-key') {
          valueKind = 'literal_dev_key';
        } else if (val === '[secretRef]') {
          valueKind = 'secretRef';
        } else {
          valueKind = 'literal_set';
        }
        break;
      }
      const resolutionEvidence = {
        resolvedFrom,
        valueKind,
        present: {
          PATIENT_RECORD_FACTS_ENCRYPTION_KEY: env.names.has('PATIENT_RECORD_FACTS_ENCRYPTION_KEY'),
          BILLING_DATA_ENCRYPTION_KEY: env.names.has('BILLING_DATA_ENCRYPTION_KEY'),
          SESSION_SECRET: env.names.has('SESSION_SECRET'),
        },
        // Never print secret material — only presence / kind
        kinds: Object.fromEntries(
          order.map((n) => [
            n,
            !env.names.has(n)
              ? 'absent'
              : env.values[n] === '[secretRef]'
                ? 'secretRef'
                : env.values[n] === 'dev-billing-key'
                  ? 'literal_dev_key'
                  : env.values[n]
                    ? 'set_redacted'
                    : 'empty',
          ]),
        ),
      };
      if (resolvedFrom === 'literal:dev-billing-key' || valueKind === 'literal_dev_key') {
        note(
          'encryption_key',
          'FAIL',
          `CATASTROPHIC: facts cipher resolves from ${resolvedFrom} (${valueKind}) — not a production key`,
          resolutionEvidence,
        );
      } else if (resolvedFrom !== 'PATIENT_RECORD_FACTS_ENCRYPTION_KEY') {
        note(
          'encryption_key',
          'FAIL',
          `PATIENT_RECORD_FACTS_ENCRYPTION_KEY unset — runtime fallthrough resolves from ${resolvedFrom} (${valueKind})`,
          resolutionEvidence,
        );
      } else {
        note(
          'encryption_key',
          'PASS',
          `Facts cipher resolves from PATIENT_RECORD_FACTS_ENCRYPTION_KEY (${valueKind}); value not printed`,
          resolutionEvidence,
        );
      }
      // ClamAV env
      const clam = env.names.has('CLAMAV_SOCKET') || env.names.has('CLAMAV_BIN');
      note(
        'clamav_env',
        clam ? 'PASS' : 'FAIL',
        clam ? 'CLAMAV_SOCKET or CLAMAV_BIN present on Cloud Run' : 'Neither CLAMAV_SOCKET nor CLAMAV_BIN on Cloud Run env',
        null,
      );
      const azure =
        env.names.has('AZURE_STORAGE_CONNECTION_STRING') ||
        env.names.has('AZURE_STORAGE_ACCOUNT') ||
        env.names.has('AZURE_BLOB_CONNECTION_STRING');
      const gcsMedia = env.names.has('GCS_MEDIA_BUCKET') && env.values.GCS_MEDIA_BUCKET && env.values.GCS_MEDIA_BUCKET !== '[empty]';
      note(
        'media_env',
        azure || gcsMedia ? 'PASS' : 'WARN',
        azure
          ? 'Azure storage env present on Cloud Run'
          : gcsMedia
            ? `GCS_MEDIA_BUCKET set (${env.values.GCS_MEDIA_BUCKET})`
            : 'No Azure or GCS_MEDIA_BUCKET on Cloud Run',
        null,
      );
      const vision = env.values.FACE_READ_VISION_ENABLED === '1' || env.values.FACE_READ_VISION_ENABLED === '[secretRef]';
      note(
        'vision_env',
        env.names.has('FACE_READ_VISION_ENABLED') && vision ? 'PASS' : 'FAIL',
        `FACE_READ_VISION_ENABLED=${env.values.FACE_READ_VISION_ENABLED || '(unset)'}`,
        null,
      );
    }
  } else {
    note(
      'encryption_key',
      'FAIL',
      'Not verified live — re-run with VERIFY_GCLOUD=1 after `gcloud auth login`, or deploy medical routes and inspect encrypted fact rows',
      null,
    );
  }

  // 4. OTP
  if (SKIP_OTP) {
    note('otp_email', 'WARN', 'SKIP_OTP=1 — email side effect skipped', null);
  } else {
    const email = OTP_EMAIL || `touche-prod-gate-${Date.now()}@example.com`;
    const otp = await httpJson('POST', '/api/patient/verify/send', {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ToucheProdGate/1.0' },
      body: JSON.stringify({ email }),
    });
    if (otp.status === 200 && otp.json?.success) {
      note(
        'otp_email',
        OTP_EMAIL ? 'WARN' : 'WARN',
        OTP_EMAIL
          ? `API accepted send to ${email} (session ${otp.json.session_id}) — HUMAN must confirm inbox delivery`
          : `API accepted send (session ${otp.json.session_id}) to disposable ${email} — does NOT prove inbox delivery; set TOUCHE_PROD_OTP_EMAIL`,
        { session_id: otp.json.session_id, message: otp.json.message },
      );
    } else if (otp.status === 503 || otp.json?.error === 'email_delivery_not_configured') {
      note('otp_email', 'FAIL', 'Email delivery not configured in prod', otp.json || otp.text.slice(0, 200));
    } else {
      note('otp_email', 'FAIL', `OTP send failed HTTP ${otp.status}`, otp.json || otp.text.slice(0, 200));
    }
  }

  // 5. Vision / face-read
  const fr = await multipart('/api/public/face-read', {}, {
    name: 'image',
    buffer: jpeg,
    type: 'image/jpeg',
    filename: 'probe.jpg',
  });
  if (fr.status === 200 && fr.json?.success) {
    const visionUsed = Boolean(fr.json?.face_read?.vision || fr.json?.face_read?.ai || fr.json?.face_read?.vision_model);
    note(
      'vision',
      visionUsed || fr.json?.face_read ? 'PASS' : 'WARN',
      visionUsed
        ? 'Face-read succeeded with vision fields present'
        : 'Face-read HTTP 200 — inspect face_read payload for vision vs CV-only',
      { keys: fr.json?.face_read ? Object.keys(fr.json.face_read).slice(0, 20) : [] },
    );
  } else if (fr.status === 503) {
    note('vision', 'FAIL', 'Face-read inference base URL missing or service unavailable (503)', fr.json || fr.text.slice(0, 200));
  } else if (fr.status === 502) {
    note(
      'vision',
      'FAIL',
      'Face-read proxy fetch failed (502) — FACE_READ_INFERENCE_BASE_URL unreachable or inference down; vision path not proven',
      fr.json || fr.text.slice(0, 200),
    );
  } else {
    note('vision', 'FAIL', `Face-read HTTP ${fr.status}`, fr.json || fr.text.slice(0, 200));
  }

  // 6. Migrations — require gcloud exec or admin; mark fail if medical routes absent
  if (!medicalRoutesPresent) {
    note(
      'migrations_065_074',
      'FAIL',
      'Cannot verify schema — medical-tracker HTTP surface not deployed (routes 404). Migrations may be absent from the running revision entirely.',
      null,
    );
  } else if (anon.status >= 200 && anon.status < 300 && anon.json?.fact?.id) {
    note(
      'migrations_065_074',
      'PASS',
      'Live write succeeded (patient_record_facts + pending_captures path) — tables from migrations 065–074 are present on the running prod DB',
      { fact_id: anon.json.fact.id, entry_date: anon.json.fact.entry_date },
    );
  } else if (VERIFY_GCLOUD) {
    note(
      'migrations_065_074',
      'WARN',
      'HTTP surface present but schema not queried — add Cloud Run job / admin SQL check for schema_migrations versions 065–074',
      null,
    );
  } else {
    note('migrations_065_074', 'FAIL', 'Not verified — need deployed routes + DB query or VERIFY_GCLOUD job', null);
  }

  // 7. E2E smoke chain
  if (!medicalRoutesPresent) {
    note(
      'e2e_smoke',
      'FAIL',
      'BLOCKED: capture→confirm→calendar→progress→physician.pdf impossible — medical-tracker routes 404 on this API host',
      null,
    );
  } else {
    note('e2e_smoke', 'WARN', 'Routes mounted — full authenticated smoke not run in this script (needs session). Use patient OTP session next.', null);
  }

  const summary = {
    apiBase: API_BASE,
    generatedAt: new Date().toISOString(),
    results,
    failCount: results.filter((r) => r.status === 'FAIL').length,
    warnCount: results.filter((r) => r.status === 'WARN').length,
    passCount: results.filter((r) => r.status === 'PASS').length,
  };
  const outJson = path.join(OUT_DIR, 'verify-touche-prod-capture.json');
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));
  const md = [
    `# Touche prod capture gate`,
    '',
    `- API: ${API_BASE}`,
    `- At: ${summary.generatedAt}`,
    `- PASS ${summary.passCount} · WARN ${summary.warnCount} · FAIL ${summary.failCount}`,
    '',
    ...results.map((r) => `- **${r.status}** \`${r.id}\`: ${r.detail}`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'VERIFY_SUMMARY.md'), md);
  console.log(`\nWrote ${outJson}`);
  if (summary.failCount > 0) {
    console.error(`\nGATE FAILED (${summary.failCount} failures)`);
    process.exit(1);
  }
  console.log('\nGATE PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
