'use strict';

/**
 * Step 4 scope item 4 — live runtime regression script (runtime DB).
 * Usage: node scripts/prove-step4-runtime-debug.js
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
const { registerPatientAllergenRoutes } = require('../routes/patient-allergens');
const { registerPatientAlertsRoutes } = require('../routes/patient-alerts');
const { registerPatientBioProfileRoutes } = require('../routes/patient-bio-profile');
const { createShopifyWebhookRouter } = require('../routes/shopify-webhooks');
const { ensureCommerceTables, upsertVariantMap, ingestShopifyOrder } = require('../services/shopify-order-ingest-service');
const { commerceBridgeReady, verifyShopifyHmac, getShopifyWebhookSecret } = require('../lib/shopify-hmac');
const { registerPatientCommerceRoutes } = require('../routes/patient-commerce');
const { requireAdminAuth } = require('../middleware/admin-auth');
const crypto = require('crypto');

const noop = (req, _res, next) => next();
const OTP = '424242';
const EMAIL_FLOW = 'step4.debug.tryflow@trytouche.local';
const EMAIL_PURGE = 'step4.debug.purge@trytouche.local';
const EMAIL_WH = 'step4.debug.webhook@trytouche.local';

function clearEmail(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(`SELECT id, patient_id FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
    .all(email);
  for (const s of sessions) {
    try {
      sqlite.prepare(`DELETE FROM patient_sessions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_allergen_exclusions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_bio_profiles WHERE session_id=? OR patient_id=?`).run(s.id, s.patient_id || '');
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id=?`).run(s.id);
    } catch (_) {}
  }
  sqlite.prepare(`DELETE FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`).run(email);
  try {
    sqlite.prepare(`DELETE FROM shopify_order_dead_letters WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
  try {
    sqlite.prepare(`DELETE FROM email_verification_codes WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
}

function buildApp() {
  ensureRoutineTables();
  ensureCommerceTables(db.db);
  shelfApi.ensurePatientShelfInventoryColumns();
  const app = express();
  app.use('/webhooks/shopify', createShopifyWebhookRouter(db));
  app.use(express.json());
  const deps = {
    apiLimiter: noop,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    requireAdminAuth,
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
  registerPatientAllergenRoutes(app, deps);
  registerPatientAlertsRoutes(app, deps);
  registerPatientBioProfileRoutes(app, deps);
  registerPatientCommerceRoutes(app, deps);
  // public evaluate if mounted elsewhere — use shelf evaluate-pair after add
  return app;
}

async function otpConfirm(app, email) {
  clearEmail(email);
  const sessionId = uuidv4();
  db.insertVerificationSession({
    sessionId,
    email,
    code: OTP,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ip: '127.0.0.1',
    userAgent: 'step4-runtime',
  });
  const confirm = await request(app).post('/api/patient/verify/confirm').send({ email, code: OTP });
  if (confirm.status !== 200 || !confirm.body?.session_id) {
    throw new Error(`OTP fail ${confirm.status} ${JSON.stringify(confirm.body)}`);
  }
  try {
    db.touchLastSeen(confirm.body.session_id);
  } catch (_) {}
  return confirm.body.session_id;
}

async function main() {
  const report = { runtime_db: db.sqliteDatabasePath, flows: {} };
  const app = buildApp();

  // ---------- A: anonymous try → allergen → OTP → shelf ----------
  {
    const pending = {
      product_name: 'Step4 Acrylate Polish',
      ingredients_text: 'ethyl methacrylate, hydroxyethyl methacrylate, fragrance',
    };
    const sid = await otpConfirm(app, EMAIL_FLOW);
    const hdr = { 'x-session-id': sid };

    const allergens = await request(app)
      .post('/api/patient/allergens')
      .set(hdr)
      .send({ allergens: [{ allergen_class: 'acrylates', label: 'acrylates' }] });

    const before = await request(app).get('/api/patient/shelf/products').set(hdr);
    const add = await request(app).post('/api/patient/shelf/products').set(hdr).send(pending);
    const after = await request(app).get('/api/patient/shelf/products').set(hdr);
    const productId = add.body?.product?.id;
    const evalRes = await request(app)
      .post('/api/patient/shelf/evaluate-pair')
      .set(hdr)
      .send({ product_ids: [productId] });
    const alerts = await request(app).get('/api/patient/alerts').set(hdr);

    const overall = String(evalRes.body?.overall || evalRes.body?.verdict?.overall || '').toLowerCase();
    const productStatus = (evalRes.body?.product_statuses || [])[0]?.status;
    report.flows.try_otp_shelf = {
      allergen_post: { status: allergens.status },
      shelf_before: (before.body?.products || []).length,
      shelf_after: (after.body?.products || []).length,
      product_id: productId,
      evaluate: {
        status: evalRes.status,
        overall,
        product_status: productStatus,
        hero_title: evalRes.body?.hero_title,
      },
      alerts: { status: alerts.status, count: (alerts.body?.alerts || alerts.body?.items || []).length },
      pass:
        allergens.status < 300 &&
        (before.body?.products || []).length === 0 &&
        (after.body?.products || []).length >= 1 &&
        !!productId &&
        evalRes.status === 200 &&
        (overall === 'hard_no' || overall === 'avoid'),
    };
  }

  // ---------- B: hard-no language consistency ----------
  {
    const sid = await otpConfirm(app, 'step4.debug.hardno@trytouche.local');
    const hdr = { 'x-session-id': sid };
    await request(app)
      .post('/api/patient/allergens')
      .set(hdr)
      .send({ allergens: [{ allergen_class: 'acrylates', label: 'acrylates' }] });
    const add = await request(app)
      .post('/api/patient/shelf/products')
      .set(hdr)
      .send({
        product_name: 'HardNo Gel',
        ingredients_text: 'ethyl methacrylate, trimethylolpropane trimethacrylate',
      });
    const pid = add.body?.product?.id;
    const ev = await request(app)
      .post('/api/patient/shelf/evaluate-pair')
      .set(hdr)
      .send({ product_ids: [pid] });
    const al = await request(app).get('/api/patient/alerts').set(hdr);
    const pStatus = (ev.body?.product_statuses || [])[0]?.status;
    const alertHard = (al.body?.alerts || al.body?.items || []).some(
      (a) => a.kind === 'hard_no' || a.severity === 'hard_no',
    );
    const inconsistency = ev.body?.overall === 'hard_no' && pStatus === 'safe';
    report.flows.hard_no_chain = {
      product_id: pid,
      eval_status: ev.status,
      overall: ev.body?.overall,
      product_status: pStatus,
      hero_title: ev.body?.hero_title,
      alert_hard: alertHard,
      severity_language_consistent: ev.body?.overall === 'hard_no' && pStatus === 'hard_no' && alertHard,
      new_bug_was: 'product_statuses.status stayed safe while overall/alerts said hard_no — FIXED in consumer-evaluate-nodes',
      pass: ev.status === 200 && ev.body?.overall === 'hard_no' && pStatus === 'hard_no' && alertHard && !inconsistency,
    };
  }

  // ---------- C: webhook + flag override + tag merge smoke ----------
  {
    upsertVariantMap(db.db, {
      shopify_variant_id: 'step4_var_known',
      sku: 'STEP4-BARRIER',
      product_name: 'Step4 Barrier',
      ingredients_text: 'ceramide np, glycerin',
    });
    const prev = process.env.COMMERCE_CTAS_ENABLED;
    process.env.COMMERCE_CTAS_ENABLED = '0';
    const off = commerceBridgeReady(db.db);
    process.env.COMMERCE_CTAS_ENABLED = '1';
    const on = commerceBridgeReady(db.db);
    if (prev === undefined) delete process.env.COMMERCE_CTAS_ENABLED;
    else process.env.COMMERCE_CTAS_ENABLED = prev;

    const sid = await otpConfirm(app, EMAIL_WH);
    const orderId = `ord_step4_${Date.now()}`;
    const order = {
      id: orderId,
      email: EMAIL_WH,
      customer: { id: 90001, email: EMAIL_WH, tags: 'vip,newsletter' },
      line_items: [{ variant_id: 'step4_var_known', title: 'Step4 Barrier', quantity: 1 }],
    };
    const ingest = ingestShopifyOrder(db.db, order);
    // match after session exists
    const { matchOrderEmailToSession } = require('../services/shopify-order-ingest-service');
    let match = null;
    try {
      if (typeof matchOrderEmailToSession === 'function') {
        match = matchOrderEmailToSession(db.db, { email: EMAIL_WH, shopify_order_id: orderId });
      }
    } catch (e) {
      match = { error: e.message };
    }

    // tag merge unit path
    const { mergeAppMemberTags, tagShopifyCustomerAppMember } = require('../services/shopify-order-ingest-service');
    const merged = mergeAppMemberTags('vip,newsletter');
    const calls = [];
    const prevFetch = global.fetch;
    global.fetch = async (url, opts = {}) => {
      calls.push({ method: (opts.method || 'GET').toUpperCase(), body: opts.body });
      if ((opts.method || 'GET').toUpperCase() === 'GET') {
        return { ok: true, json: async () => ({ customer: { id: 90001, tags: 'vip,newsletter' } }) };
      }
      return { ok: true, json: async () => ({}) };
    };
    process.env.SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'demo.myshopify.com';
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || 'shpat_test';
    const putTags = await tagShopifyCustomerAppMember(90001);
    global.fetch = prevFetch;

    report.flows.webhook_flag_tags = {
      commerce_flag_0: off,
      commerce_flag_1: on,
      ingest,
      match,
      session_id: sid,
      merge_helper: merged,
      tag_sequence: calls.map((c) => c.method),
      put_tags: putTags,
      pass: off === false && on === true && merged.includes('vip') && merged.includes('app_member') && calls[0]?.method === 'GET',
      new_bug: null,
    };
  }

  // ---------- D: purge regression ----------
  {
    const sid = await otpConfirm(app, EMAIL_PURGE);
    const hdr = { 'x-session-id': sid };
    await request(app)
      .post('/api/patient/allergens')
      .set(hdr)
      .send({ allergens: [{ allergen_class: 'fragrance', label: 'fragrance' }] });
    await request(app)
      .post('/api/patient/shelf/products')
      .set(hdr)
      .send({ product_name: 'Purge Me Serum', ingredients_text: 'water' });

    const beforeSessions = db.db
      .prepare(`SELECT COUNT(*) AS n FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
      .get(EMAIL_PURGE).n;
    const del = await request(app).post('/api/patient/account/delete').set(hdr).send({ confirm: true });
    const afterSessions = db.db
      .prepare(`SELECT COUNT(*) AS n FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
      .get(EMAIL_PURGE).n;
    const stale = await request(app).get('/api/patient/shelf/products').set(hdr);
    report.flows.purge = {
      before_sessions: beforeSessions,
      after_sessions: afterSessions,
      delete: { status: del.status, purged: del.body?.purged },
      stale_shelf: { status: stale.status, error: stale.body?.error },
      pass: del.status === 200 && del.body?.purged === true && afterSessions === 0 && (stale.status === 401 || stale.status === 403),
      new_bug: null,
    };
  }

  const allPass = Object.values(report.flows).every((f) => f.pass);
  console.log(JSON.stringify(report, null, 2));
  if (!allPass) process.exit(1);
  console.log('\nSTEP4 RUNTIME: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
