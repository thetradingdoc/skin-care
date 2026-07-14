'use strict';

/**
 * TOUCH-026 — OTP verify → live shelf POST for anonymous pending product.
 * Uses real runtime DB + real verifyCode path + real POST /api/patient/shelf/products.
 *
 * Usage: node scripts/prove-touch-026-otp-shelf.js
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

process.chdir(path.join(__dirname, '..'));

const express = require('express');
const request = require('supertest');
const db = require('../database');
const PatientPortalService = require('../services/patient-portal-service');
const {
  requirePatientSession,
  resolvePatientIdFromSession,
  recordPatientPortalEvent,
} = require('../middleware/patient-session');
const shelfApi = require('../lib/patient-shelf-api');
const { ensureRoutineTables } = require('../lib/patient-routine-db');
const { registerPatientShelfRoutes } = require('../routes/patient-shelf');
const { registerPatientAuthRoutes } = require('../routes/patient-auth');

const EMAIL = 'touch026.otp.shelf@trytouche.local';
const OTP = '424242';
const PENDING = {
  product_name: 'Anonymous Try Barrier Cream',
  ingredients_text: 'ceramide np, glycerin, water',
  query: 'barrier cream',
};
const noop = (req, _res, next) => next();

function clearEmail(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(`SELECT id FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
    .all(email);
  for (const s of sessions) {
    try {
      sqlite.prepare(`DELETE FROM patient_sessions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      // wipe shelf lists
      const lists = sqlite
        .prepare(`SELECT id FROM patient_product_lists WHERE owner_id=?`)
        .all(s.id);
      for (const l of lists) {
        sqlite.prepare(`DELETE FROM patient_product_list_items WHERE list_id=?`).run(l.id);
        sqlite.prepare(`DELETE FROM patient_product_lists WHERE id=?`).run(l.id);
      }
    } catch (_) {}
  }
  sqlite.prepare(`DELETE FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`).run(email);
}

function buildApp() {
  ensureRoutineTables();
  shelfApi.ensurePatientShelfInventoryColumns();
  const app = express();
  app.use(express.json());
  const deps = {
    apiLimiter: noop,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    PatientPortalService,
    ensurePatientShelfInventoryColumns: shelfApi.ensurePatientShelfInventoryColumns,
    loadPatientShelfProductRows: shelfApi.loadPatientShelfProductRows,
    formatShelfProductApiRow: shelfApi.formatShelfProductApiRow,
    isIsoDateOnly: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
    ensureRoutineTables,
    ensureBillingTables: noop,
    parseBillingDocumentUpload: noop,
    safeParseJsonArray: () => [],
    localDateFromIso: (d) => d,
    isoFromLocalDate: (d) => d,
    weekdayKeyForIsoLocal: () => 'mon',
    enumerateIsoDates: () => [],
    issuePatientDocumentDownloadUrl: () => null,
    fetchBillingAggregatesByDay: () => ({}),
    fieldsFromSqlAggRow: () => ({}),
    billingOk: (_req, res, data) => res.json(data),
    billingErr: (_req, res, e) => res.status(400).json({ error: e }),
    resolveBillingSubscription: () => ({}),
    requirePlusForBillingFeature: () => noop,
    getPatientStep3Status: () => ({ completed: true }),
    ensureProductsPhase2Tables: noop,
    blockWalletWhenDisabled: noop,
    blockChatWhenDisabled: noop,
    isPatientWalletEnabled: () => false,
    isPatientChatEnabled: () => false,
    parseBooleanFlag: () => false,
    withIdempotency: (_k, fn) => fn,
    assertPatientOwnsAppointmentOrThrow: noop,
    validatePatientAvailableSlotsQuery: noop,
    validatePatientBookingScheduleBody: noop,
    botGuard: noop,
    authLimiter: noop,
    otpSendLimiter: noop,
    otpConfirmLimiter: noop,
    issueCsrfCookie: () => 'csrf',
    PatientIntakeService: null,
  };
  registerPatientAuthRoutes(app, deps);
  registerPatientShelfRoutes(app, deps);
  return app;
}

async function main() {
  clearEmail(EMAIL);

  // Stage A: anonymous pending product exists only client-side; server has no shelf yet.
  // Simulate OTP signup: insertVerificationSession + verifyCode (same path as /verify/confirm).
  const pendingSessionId = uuidv4();
  db.insertVerificationSession({
    sessionId: pendingSessionId,
    email: EMAIL,
    code: OTP,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ip: '127.0.0.1',
    userAgent: 'touch-026-otp-shelf',
  });

  const app = buildApp();

  // Confirm via the real HTTP OTP confirm endpoint (not just service call).
  const confirm = await request(app)
    .post('/api/patient/verify/confirm')
    .send({ email: EMAIL, code: OTP });

  if (confirm.status !== 200 || !confirm.body?.session_id) {
    throw new Error(`OTP confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`);
  }

  const sessionId = confirm.body.session_id;
  const hdr = { 'x-session-id': sessionId };

  const shelfBefore = await request(app).get('/api/patient/shelf/products').set(hdr);
  const beforeProducts = shelfBefore.body?.products || shelfBefore.body?.items || [];

  // Stage B: same live POST finishWithSession would issue after verify (TOUCH-026).
  const add = await request(app)
    .post('/api/patient/shelf/products')
    .set(hdr)
    .send({
      product_name: PENDING.product_name,
      ingredients_text: PENDING.ingredients_text,
    });

  const shelfAfter = await request(app).get('/api/patient/shelf/products').set(hdr);
  const afterProducts = shelfAfter.body?.products || shelfAfter.body?.items || [];
  const names = afterProducts.map((p) => p.product_name || p.name);

  const report = {
    runtime_db: db.sqliteDatabasePath,
    pending_product: PENDING,
    otp_confirm: { status: confirm.status, session_id: sessionId },
    shelf_before: {
      status: shelfBefore.status,
      count: beforeProducts.length,
      products: beforeProducts,
    },
    live_post: { status: add.status, body: add.body },
    shelf_after: {
      status: shelfAfter.status,
      count: afterProducts.length,
      products: afterProducts,
      names,
    },
    pass:
      confirm.status === 200 &&
      beforeProducts.length === 0 &&
      add.status >= 200 &&
      add.status < 300 &&
      afterProducts.length >= 1 &&
      names.some((n) => String(n).includes('Anonymous Try Barrier')),
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
  console.log('\nTOUCH-026: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
