#!/usr/bin/env node
'use strict';

/**
 * Phase 3 acceptance HTTP proofs against the real runtime DB + real auth middleware.
 *
 * Prerequisites:
 *   node scripts/seed-phase3-acceptance-session.js
 *
 * Usage:
 *   node scripts/prove-phase3-acceptance-http.js
 *   SESSION_ALERT=<id> SESSION_ZERO=<id> PRODUCT_ID=<id> node scripts/prove-phase3-acceptance-http.js
 */

const path = require('path');
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
const { registerPatientAllergenRoutes } = require('../routes/patient-allergens');
const { registerPatientAlertsRoutes } = require('../routes/patient-alerts');
const { registerPatientBioProfileRoutes } = require('../routes/patient-bio-profile');
const { upsertBioProfile, getBioProfile } = require('../services/patient-bio-profile-service');
const { runEvaluatePipelineSync } = require('../services/consumer-evaluate-nodes');
const { daysLeftFromExpiry } = require('../lib/patient-shelf-api');

const noop = (req, _res, next) => next();

function buildApp() {
  ensureRoutineTables();
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
    getPatientStep3Status: () => ({}),
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
    validatePatientTriageBody: noop,
    requireCsrfForCookieAuth: noop,
    auditBookingEvent: noop,
    botGuard: noop,
    authLimiter: noop,
    otpSendLimiter: noop,
    otpConfirmLimiter: noop,
  };
  registerPatientShelfRoutes(app, deps);
  registerPatientAllergenRoutes(app, deps);
  registerPatientAlertsRoutes(app, deps);
  registerPatientBioProfileRoutes(app, deps);
  return app;
}

function readShelf(productId) {
  return db.db
    .prepare(
      `SELECT id, inventory_status, kept_despite_conflict, verdict_status, cost_per_use, expiry_date
       FROM patient_onboarding_step3_products WHERE id = ?`,
    )
    .get(productId);
}

function discoverSessions() {
  if (process.env.SESSION_ALERT && process.env.SESSION_ZERO) {
    return {
      alert: process.env.SESSION_ALERT,
      zero: process.env.SESSION_ZERO,
      productId: process.env.PRODUCT_ID || 'shelf_phase3_accept_acrylate',
    };
  }
  const alert = db.db
    .prepare(
      `SELECT id FROM patient_portal_sessions
       WHERE LOWER(email)=LOWER('phase3.accept.alert@trytouche.local') AND verified=1
         AND (revoked_at IS NULL)
       ORDER BY datetime(verified_at) DESC LIMIT 1`,
    )
    .get();
  const zero = db.db
    .prepare(
      `SELECT id FROM patient_portal_sessions
       WHERE LOWER(email)=LOWER('phase3.accept.zero@trytouche.local') AND verified=1
         AND (revoked_at IS NULL)
       ORDER BY datetime(verified_at) DESC LIMIT 1`,
    )
    .get();
  if (!alert?.id || !zero?.id) {
    throw new Error('Seed sessions not found. Run: node scripts/seed-phase3-acceptance-session.js');
  }
  return {
    alert: alert.id,
    zero: zero.id,
    productId: 'shelf_phase3_accept_acrylate',
  };
}

async function main() {
  const { alert, zero, productId } = discoverSessions();
  const app = buildApp();
  const hdr = (sid) => ({ 'x-session-id': sid });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Phase 3 HTTP acceptance proofs');
  console.log('Runtime DB:', db.sqliteDatabasePath);
  console.log('alert session:', alert);
  console.log('zero session:', zero);
  console.log('product:', productId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Auth smoke
  for (const [label, sid] of [
    ['alert', alert],
    ['zero', zero],
  ]) {
    const v = PatientPortalService.validateSession(sid);
    if (!v.valid) throw new Error(`${label} session invalid: ${v.error}`);
  }

  const report = {};

  // --- TOUCH-060/061 ---
  {
    // Reset shelf flags so keep/remove are observable on re-run
    db.db
      .prepare(
        `UPDATE patient_onboarding_step3_products
         SET inventory_status='stock', kept_despite_conflict=0, verdict_status='unknown'
         WHERE id=?`,
      )
      .run(productId);
    const before = readShelf(productId);
    const keepReq = { action: 'keep' };
    const keepRes = await request(app)
      .post(`/api/patient/shelf/products/${productId}/verdict-action`)
      .set(hdr(alert))
      .send(keepReq);
    const afterKeep = readShelf(productId);
    const removeReq = { action: 'remove' };
    const removeRes = await request(app)
      .post(`/api/patient/shelf/products/${productId}/verdict-action`)
      .set(hdr(alert))
      .send(removeReq);
    const afterRemove = readShelf(productId);
    report['060_061'] = {
      before,
      keep: { request: keepReq, status: keepRes.status, body: keepRes.body, db: afterKeep },
      remove: { request: removeReq, status: removeRes.status, body: removeRes.body, db: afterRemove },
    };
    // Restore stock for later alert/evaluate proofs
    db.db
      .prepare(
        `UPDATE patient_onboarding_step3_products
         SET inventory_status='stock', kept_despite_conflict=1, verdict_status='kept'
         WHERE id=?`,
      )
      .run(productId);
  }

  // --- TOUCH-064/065 ---
  {
    db.db
      .prepare(
        `UPDATE patient_onboarding_step3_products SET cost_per_use=NULL, expiry_date=NULL WHERE id=?`,
      )
      .run(productId);
    const before = readShelf(productId);
    const patchReq = { cost_per_use: 0.42, expiry_date: '2026-10-01' };
    const patchRes = await request(app)
      .patch(`/api/patient/shelf/products/${productId}`)
      .set(hdr(alert))
      .send(patchReq);
    const after = readShelf(productId);
    report['064_065'] = {
      before,
      request: patchReq,
      status: patchRes.status,
      response: patchRes.body,
      db_after: after,
      days_left_computed: daysLeftFromExpiry(after?.expiry_date),
      days_left_in_response: patchRes.body?.product?.days_left,
    };
  }

  // --- TOUCH-066/067/068 ---
  {
    const zeroRes = await request(app).get('/api/patient/alerts').set(hdr(zero));
    const zeroCount = await request(app).get('/api/patient/alerts/count').set(hdr(zero));
    const alertRes = await request(app).get('/api/patient/alerts').set(hdr(alert));
    const alertCount = await request(app).get('/api/patient/alerts/count').set(hdr(alert));
    report['066_068'] = {
      zero: {
        list_status: zeroRes.status,
        list_body: zeroRes.body,
        count_status: zeroCount.status,
        count_body: zeroCount.body,
      },
      alert_bearing: {
        list_status: alertRes.status,
        list_body: alertRes.body,
        count_status: alertCount.status,
        count_body: alertCount.body,
        severities: (alertRes.body?.alerts || []).map((a) => ({
          severity: a.severity,
          kind: a.kind,
          title: a.title,
        })),
      },
    };
  }

  // --- TOUCH-100 ---
  {
    const patientId = PatientPortalService.validateSession(alert).patient_id;
    upsertBioProfile(db.db, {
      sessionId: alert,
      patientId,
      patch: { procedure_date: '2020-01-01', procedure_type: 'laser' },
    });
    const before = runEvaluatePipelineSync(db.db, { sessionId: alert, patientId });
    upsertBioProfile(db.db, {
      sessionId: alert,
      patientId,
      patch: { procedure_date: new Date().toISOString().slice(0, 10), procedure_type: 'laser' },
    });
    const during = runEvaluatePipelineSync(db.db, { sessionId: alert, patientId });
    report['100'] = {
      before: {
        safe_mode: before?.safe_mode,
        suppressed_steps: before?.suppressed_steps,
        overall: before?.overall,
        hard_no: before?.hard_no,
        hard_no_hits: before?.hard_no_hits,
      },
      during: {
        safe_mode: during?.safe_mode,
        suppressed_steps: during?.suppressed_steps,
        overall: during?.overall,
        hard_no: during?.hard_no,
        hard_no_hits: during?.hard_no_hits,
        acrylate_free_verified: during?.acrylate_free_verified,
      },
    };
  }

  // --- TOUCH-101 ---
  {
    const patientId = PatientPortalService.validateSession(alert).patient_id;
    // inactive via HTTP PUT (requires bio route fix for procedure_*)
    const putInactive = await request(app)
      .put('/api/patient/bio-profile')
      .set(hdr(alert))
      .send({ procedure_date: '2020-01-01', procedure_type: 'laser', conditions: ['sensitive'] });
    const getInactive = await request(app).get('/api/patient/check/safe-mode').set(hdr(alert));
    const putActive = await request(app)
      .put('/api/patient/bio-profile')
      .set(hdr(alert))
      .send({
        procedure_date: new Date().toISOString().slice(0, 10),
        procedure_type: 'laser',
        conditions: ['sensitive'],
      });
    const getActive = await request(app).get('/api/patient/check/safe-mode').set(hdr(alert));
    report['101'] = {
      put_inactive: { status: putInactive.status, procedure: putInactive.body?.profile?.procedure_date },
      get_inactive: { status: getInactive.status, body: getInactive.body },
      put_active: { status: putActive.status, procedure: putActive.body?.profile?.procedure_date },
      get_active: { status: getActive.status, body: getActive.body },
      bio_after: getBioProfile(db.db, { sessionId: alert, patientId }),
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
