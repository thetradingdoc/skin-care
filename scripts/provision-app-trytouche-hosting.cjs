#!/usr/bin/env node
'use strict';

/**
 * Provision dedicated Firebase Hosting site for app.trytouche.com (project somo-4ddf6).
 * Does NOT modify the myskinandcare site or firebase.consumer.json.
 *
 * Prerequisites:
 *   firebase login --reauth   # as richard@callsomo.com (Workspace RAPT may require browser)
 *
 * Usage:
 *   node scripts/provision-app-trytouche-hosting.cjs
 *
 * After success:
 *   1. Remove app.trytouche.com from site myskinandcare (if listed under Custom domains).
 *   2. Firebase Console → site app-trytouche → Add custom domain → app.trytouche.com
 *   3. Edit IONOS CNAME `app` from myskinandcare.web.app → app-trytouche.web.app
 *   4. npm run deploy:app-trytouche-hosting
 */

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROJECT = 'somo-4ddf6';
const SITE = 'app-trytouche';

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} exited ${r.status}`);
  }
}

function main() {
  // Prefer volta/global firebase over stale npx cache.
  const firebase = process.env.FIREBASE_BIN || 'firebase';

  run(firebase, ['--version']);
  run(firebase, ['hosting:sites:list', `--project=${PROJECT}`]);

  console.log(`\nCreating site ${SITE} (idempotent if it already exists)…`);
  const create = spawnSync(
    firebase,
    ['hosting:sites:create', SITE, `--project=${PROJECT}`],
    { cwd: ROOT, encoding: 'utf8', env: process.env },
  );
  const out = `${create.stdout || ''}\n${create.stderr || ''}`;
  if (create.status === 0) {
    console.log(out.trim() || `Created ${SITE}`);
  } else if (/already exists|ALREADY_EXISTS/i.test(out)) {
    console.log(`Site ${SITE} already exists — OK`);
  } else {
    console.error(out);
    throw new Error(
      'Could not create hosting site. Run: firebase login --reauth\n' +
        'Then re-run this script.',
    );
  }

  console.log(`
Next (human / Console — do before editing IONOS):
  1. https://console.firebase.google.com/project/${PROJECT}/hosting/sites/myskinandcare
     → if Custom domains lists app.trytouche.com, REMOVE it first.
  2. https://console.firebase.google.com/project/${PROJECT}/hosting/sites/${SITE}
     → Add custom domain → app.trytouche.com
     → Confirm CNAME target is ${SITE}.web.app (usual default).
  3. IONOS → trytouche.com → DNS → EDIT existing CNAME host "app":
       FROM  myskinandcare.web.app
       TO    ${SITE}.web.app
  4. npm run deploy:app-trytouche-hosting

Default site URL after create: https://${SITE}.web.app
`);
}

main();
