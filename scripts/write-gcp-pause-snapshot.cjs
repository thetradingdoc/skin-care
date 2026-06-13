#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT = path.join(ROOT, '.gcp-pause-snapshot.json');
const PROJECT = 'somo-callsomo';
const REGION = 'us-central1';
const SERVICES = ['somo-middleware', 'face-read-inference'];

function describe(service) {
  const r = spawnSync(
    'gcloud',
    ['run', 'services', 'describe', service, `--region=${REGION}`, `--project=${PROJECT}`, '--format=json'],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(1);
  }
  return JSON.parse(r.stdout);
}

const services = SERVICES.map((name) => {
  const d = describe(name);
  const ann = d.metadata?.annotations || {};
  const tmplAnn = d.spec?.template?.metadata?.annotations || {};
  const c0 = d.spec?.template?.spec?.containers?.[0] || {};
  return {
    name,
    url: d.status?.url,
    ingress: ann['run.googleapis.com/ingress'] || 'all',
    minInstances: tmplAnn['autoscaling.knative.dev/minScale'] || '0',
    maxInstances: tmplAnn['autoscaling.knative.dev/maxScale'] || '100',
    memory: c0.resources?.limits?.memory,
    cpu: c0.resources?.limits?.cpu,
  };
});

const out = {
  pausedAt: null,
  project: PROJECT,
  region: REGION,
  firebaseSite: 'myskinandcare',
  firebaseProject: 'somo-4ddf6',
  cloudSqlInstances: [],
  services,
};

fs.writeFileSync(SNAPSHOT, `${JSON.stringify(out, null, 2)}\n`);
console.log(fs.readFileSync(SNAPSHOT, 'utf8'));
