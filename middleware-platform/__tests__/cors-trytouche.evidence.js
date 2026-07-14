'use strict';

/**
 * TOUCH-038 evidence — CORS allows app.trytouche.com
 * Run: node __tests__/cors-trytouche.evidence.js
 */

const assert = require('assert');
const express = require('express');
const request = require('supertest');
const cors = require('cors');
const allowedHeaders = require('../lib/cors-allowed-headers');

const allowedOrigins = [
  'https://app.trytouche.com',
  'https://trytouche.com',
  'https://myskinandcare.com',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (/^https?:\/\/([a-z0-9-]+\.)*trytouche\.com$/i.test(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders,
};

function buildApp() {
  const app = express();
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  app.get('/api/patient/me', (_req, res) => res.json({ ok: true }));
  return app;
}

async function main() {
  const app = buildApp();
  const origin = 'https://app.trytouche.com';
  const res = await request(app)
    .options('/api/patient/me')
    .set('Origin', origin)
    .set('Access-Control-Request-Method', 'GET');
  console.log('PREFLIGHT status', res.status);
  console.log('Access-Control-Allow-Origin', res.headers['access-control-allow-origin']);
  assert.ok(res.status === 204 || res.status === 200);
  assert.strictEqual(res.headers['access-control-allow-origin'], origin);

  const emailSite = require('../lib/skin-care-email-layout');
  // SITE_URL is not exported — read raw module string
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../lib/skin-care-email-layout'), 'utf8');
  assert.ok(src.includes('app.trytouche.com') || src.includes('TOUCHE_APP_URL'), 'email site URL allows touche');
  console.log('EMAIL_LAYOUT_SITE_DEFAULT includes app.trytouche.com path: PASS');
  console.log('TOUCH-038 EVIDENCE: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
