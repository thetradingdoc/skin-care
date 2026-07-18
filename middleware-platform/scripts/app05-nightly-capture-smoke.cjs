'use strict';

/**
 * APP-05 — Nightly capture smoke gate (API + static confirm migration).
 *
 * Always:
 *  1) Static assert confirm screens use TemplateFieldsForm (APP-04 lock-in)
 *  2) Optional live API smoke when TOUCHE_SMOKE_API_BASE is set
 *
 * Maestro device run is separate (see patient-app/.maestro/ + workflow).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');
const CONFIRM_DIR = path.join(ROOT, 'patient-app/app/capture/confirm');

const required = ['skin', 'bill', 'mark', 'other', 'rx', 'lab'];
let failed = false;

for (const name of required) {
  const file = path.join(CONFIRM_DIR, `${name}.tsx`);
  if (!fs.existsSync(file)) {
    console.error(`[APP-05] missing confirm screen: ${name}.tsx`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes('TemplateFieldsForm')) {
    console.error(`[APP-05] ${name}.tsx missing TemplateFieldsForm`);
    failed = true;
  }
}

const maestroFlow = path.join(ROOT, 'patient-app/.maestro/capture-confirm-smoke.yaml');
if (!fs.existsSync(maestroFlow)) {
  console.error('[APP-05] missing Maestro flow patient-app/.maestro/capture-confirm-smoke.yaml');
  failed = true;
} else {
  console.log('[APP-05] Maestro flow present:', path.relative(ROOT, maestroFlow));
}

if (failed) process.exit(1);

const apiBase = process.env.TOUCHE_SMOKE_API_BASE || process.env.API_BASE || '';
if (apiBase) {
  const script = path.join(__dirname, 'verify-touche-prod-capture.cjs');
  console.log('[APP-05] running live capture verify against', apiBase);
  const r = spawnSync(process.execPath, [script], {
    cwd: path.join(ROOT, 'middleware-platform'),
    env: { ...process.env, API_BASE: apiBase },
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
} else {
  console.log('[APP-05] TOUCHE_SMOKE_API_BASE unset — static gate only (OK for PR CI)');
}

console.log('[APP-05] capture smoke gate OK');
