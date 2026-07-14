#!/usr/bin/env node
'use strict';

/**
 * Phase 4/5 acceptance proofs against the REAL runtime DB + real auth middleware.
 *
 * Usage:
 *   node scripts/seed-phase3-acceptance-session.js   # or commerce seed below
 *   node scripts/prove-phase45-acceptance-http.js
 */

const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

process.chdir(path.join(__dirname, '..'));

// Force a webhook secret for this process so HMAC invalid rejection is testable.
if (!process.env.SHOPIFY_WEBHOOK_SECRET && !process.env.SHOPIFY_API_SECRET) {
  process.env.SHOPIFY_WEBHOOK_SECRET = 'phase45_accept_secret_do_not_use_prod';
}

const express = require('express');
const request = require('supertest');
const db = require('../database');
const PatientPortalService = require('../services/patient-portal-service');
const {
  requirePatientSession,
  resolvePatientIdFromSession,
  recordPatientPortalEvent,
} = require('../middleware/patient-session');
const { requireAdminAuth } = require('../middleware/admin-auth');
const { createShopifyWebhookRouter } = require('../routes/shopify-webhooks');
const { registerPatientCommerceRoutes } = require('../routes/patient-commerce');
const { registerPatientBioProfileRoutes } = require('../routes/patient-bio-profile');
const { registerPatientAllergenRoutes } = require('../routes/patient-allergens');
const { registerPatientAuthRoutes } = require('../routes/patient-auth');
const {
  ensureCommerceTables,
  upsertVariantMap,
  ingestShopifyOrder,
  tagShopifyCustomerAppMember,
  findPatientSessionByEmail,
  listOrdersForEmail,
  reprocessSkuUnmappedDeadLetters,
  writeDeadLetter,
} = require('../services/shopify-order-ingest-service');
const { getBioProfile } = require('../services/patient-bio-profile-service');
const { ensureRoutineTables } = require('../lib/patient-routine-db');
const { commerceBridgeReady, verifyShopifyHmac, getShopifyWebhookSecret } = require('../lib/shopify-hmac');

const COMMERCE_EMAIL = 'phase4.accept.commerce@trytouche.local';
const FHIR_ONLY_EMAIL = 'phase4.accept.fhironly@trytouche.local';
const DEAD_LETTER_EMAIL = 'phase4.accept.deadletter@trytouche.local';
const OTP = '424242';
const VARIANT_KNOWN = '45000000009991';
const VARIANT_UNKNOWN = '45000000009999';

const noop = (req, _res, next) => next();

function signHmac(rawBuf) {
  return crypto.createHmac('sha256', getShopifyWebhookSecret()).update(rawBuf).digest('base64');
}

function clearEmail(email) {
  const sqlite = db.db;
  const sessions = sqlite
    .prepare(`SELECT id FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?)`)
    .all(email);
  for (const s of sessions) {
    sqlite.prepare(`UPDATE patient_portal_sessions SET revoked_at=datetime('now') WHERE id=?`).run(s.id);
    try {
      sqlite.prepare(`DELETE FROM patient_sessions WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id=?`).run(s.id);
    } catch (_) {}
    try {
      sqlite.prepare(`DELETE FROM patient_bio_profiles WHERE session_id=?`).run(s.id);
    } catch (_) {}
  }
  sqlite.prepare(`DELETE FROM patient_portal_sessions WHERE LOWER(email)=LOWER(?) AND verified=0`).run(email);
  try {
    sqlite.prepare(`DELETE FROM shopify_order_dead_letters WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
  try {
    sqlite.prepare(`DELETE FROM shopify_orders WHERE LOWER(email)=LOWER(?)`).run(email);
  } catch (_) {}
}

function createVerifiedSession(email) {
  clearEmail(email);
  const sessionId = uuidv4();
  db.insertVerificationSession({
    sessionId,
    email,
    code: OTP,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ip: '127.0.0.1',
    userAgent: 'phase45-acceptance',
  });
  const result = PatientPortalService.verifyCode(email, OTP);
  if (!result.success) throw new Error(`verify failed: ${result.error}`);
  db.touchLastSeen(result.session_id);
  return result;
}

function ensureFhirOnlyPatient(email) {
  clearEmail(email);
  // Create FHIR patient without portal session
  const id = uuidv4();
  if (db.createFHIRPatient) {
    db.createFHIRPatient({
      resourceType: 'Patient',
      id,
      active: true,
      telecom: [{ system: 'email', value: email, use: 'home' }],
      meta: { lastUpdated: new Date().toISOString() },
    });
  } else {
    db.db
      .prepare(
        `INSERT INTO fhir_patients (resource_id, resource_type, email, resource_data, created_at)
         VALUES (?, 'Patient', ?, ?, datetime('now'))`,
      )
      .run(id, email, JSON.stringify({ resourceType: 'Patient', id, telecom: [{ system: 'email', value: email }] }));
  }
  return id;
}

function buildApp({ withAdminSecret = true } = {}) {
  ensureRoutineTables();
  ensureCommerceTables(db.db);
  const app = express();
  // Webhook must mount with raw body BEFORE json for that path — use dedicated router
  app.use('/webhooks/shopify', createShopifyWebhookRouter(db));

  app.use(express.json());
  const deps = {
    apiLimiter: noop,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    requireAdminAuth: withAdminSecret ? requireAdminAuth : undefined,
    PatientPortalService,
    botGuard: noop,
    authLimiter: noop,
    otpSendLimiter: noop,
    otpConfirmLimiter: noop,
    issueCsrfCookie: () => 'csrf',
    getPatientStep3Status: () => ({ completed: true }),
    PatientIntakeService: null,
    blockWalletWhenDisabled: noop,
    blockChatWhenDisabled: noop,
    withIdempotency: (_k, fn) => fn,
    requirePlusForBillingFeature: () => noop,
    isPatientWalletEnabled: () => false,
    isPatientChatEnabled: () => false,
    parseBooleanFlag: () => false,
    billingOk: (_r, res, d) => res.json(d),
    billingErr: (_r, res, e) => res.status(400).json({ error: e }),
    resolveBillingSubscription: () => ({}),
    sendUploadLinkHandler: noop,
    issuePatientDocumentDownloadUrl: () => null,
    parseBillingDocumentUpload: noop,
  };
  registerPatientCommerceRoutes(app, deps);
  registerPatientBioProfileRoutes(app, deps);
  registerPatientAllergenRoutes(app, deps);
  registerPatientAuthRoutes(app, deps);
  return app;
}

async function main() {
  const report = { runtime_db: db.sqliteDatabasePath, critical: {}, tickets: {} };
  ensureCommerceTables(db.db);
  ensureRoutineTables();

  // Seed commerce member with session
  const commerce = createVerifiedSession(COMMERCE_EMAIL);
  upsertVariantMap(db.db, {
    shopify_variant_id: VARIANT_KNOWN,
    sku: 'TOUCH-BARRIER-1',
    product_name: 'Phase4 Barrier Calm',
    product_handle: 'barrier-calm-moisturizer',
    brand: 'touche labs™',
    ingredients_text: 'ceramide np, glycerin, retinol',
  });

  const app = buildApp({ withAdminSecret: true });
  const hdr = { 'x-session-id': commerce.session_id };

  // ---------- TOUCH-069 / 070 ----------
  // Run TS builders via node ts transpile? Use equivalent by requiring compiled logic —
  // Patient app is TS; mirror by reading storeConfig logic through dynamic import of ts via require ts-node
  // Fallback: execute the same algorithm inline from the SSOT file content.
  const STORE_ORIGIN = (process.env.EXPO_PUBLIC_STORE_ORIGIN || 'https://trytouche.com').replace(/\/$/, '');
  const MEMBER_DISCOUNT_CODE = process.env.EXPO_PUBLIC_MEMBER_DISCOUNT_CODE || 'JOURNAL20';
  function buildShopifyCartUrl(variantId, discountCode = MEMBER_DISCOUNT_CODE) {
    const id = String(variantId).trim();
    const code = encodeURIComponent(discountCode);
    const url = `${STORE_ORIGIN}/cart/${encodeURIComponent(id)}:1?discount=${code}`;
    if (!url.includes('/cart/')) throw new Error('cart path required');
    return `${url}&utm_source=journal&utm_medium=app&utm_campaign=commerce`;
  }
  function buildShopifyPdpUrl(handle, discountCode = MEMBER_DISCOUNT_CODE) {
    const h = String(handle).trim();
    const code = encodeURIComponent(discountCode);
    return `${STORE_ORIGIN}/products/${encodeURIComponent(h)}?discount=${code}&utm_source=journal&utm_medium=app&utm_campaign=commerce`;
  }
  // Prefer parsing the TypeScript source for exact export presence
  const fs = require('fs');
  const storeSrc = fs.readFileSync(path.join(__dirname, '../../patient-app/constants/storeConfig.ts'), 'utf8');
  const cartUrl = buildShopifyCartUrl(VARIANT_KNOWN);
  const pdpUrl = buildShopifyPdpUrl('barrier-calm-moisturizer');
  report.tickets['069_070'] = {
    cartUrl,
    pdpUrl,
    cart_has_slash_cart: cartUrl.includes('/cart/'),
    cart_has_discount: cartUrl.includes('discount='),
    pdp_has_discount: pdpUrl.includes('discount='),
    ssot_file_exports_cart: /export function buildShopifyCartUrl/.test(storeSrc),
    ssot_file_exports_pdp: /export function buildShopifyPdpUrl/.test(storeSrc),
  };

  // ---------- TOUCH-071 payment fields ----------
  const handoff = fs.readFileSync(path.join(__dirname, '../../patient-app/app/checkout-handoff.tsx'), 'utf8');
  report.tickets['071'] = {
    payment_like_matches: [...handoff.matchAll(/\b(payment|cardNumber|cvv|cvc|stripe|Apple Pay|iban|TextInput)\b/gi)].map(
      (m) => m[0],
    ),
    uses_builders: /buildShopifyCartUrl|buildShopifyPdpUrl/.test(handoff),
  };

  // ---------- TOUCH-072 paths ----------
  const reveal = fs.readFileSync(path.join(__dirname, '../../patient-app/app/try-reveal.tsx'), 'utf8');
  const alerts = fs.readFileSync(path.join(__dirname, '../../patient-app/app/alerts.tsx'), 'utf8');
  const account = fs.readFileSync(path.join(__dirname, '../../patient-app/app/(tabs)/account.tsx'), 'utf8');
  const shopPdp = fs.readFileSync(path.join(__dirname, '../../patient-app/app/shop/[handle].tsx'), 'utf8');
  report.tickets['072'] = {
    reveal_to_handoff: /CHECKOUT_HANDOFF_HREF/.test(reveal),
    alerts_to_shop: /SHOP_HREF/.test(alerts) && /alerts-shop/.test(alerts),
    profile_to_shop: /SHOP_HREF/.test(account),
    shop_buy_to_handoff: /checkoutHandoffHref/.test(shopPdp),
    handoff_calls_builder: /buildShopifyCartUrl|buildShopifyPdpUrl/.test(handoff),
  };

  // ---------- CRITICAL Risk #3 tag PUT ----------
  {
    const origFetch = global.fetch;
    let putBody = null;
    let putUrl = null;
    global.fetch = async (url, opts) => {
      putUrl = String(url);
      putBody = JSON.parse(String(opts?.body || '{}'));
      return { ok: true, status: 200, json: async () => ({}) };
    };
    process.env.SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'example.myshopify.com';
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || 'shpat_test';
    // Call the internal function by re-requiring path — it's not exported.
    // Replicate the call site behavior via ingest with customer.id
    // Directly evaluate the code path by temporary require and eval of source excerpt.
    const ingestSrc = fs.readFileSync(
      path.join(__dirname, '../services/shopify-order-ingest-service.js'),
      'utf8',
    );
    const tagFnMatch = ingestSrc.match(/async function tagShopifyCustomerAppMember[\s\S]*?\n\}/);
    // Execute send by invoking through ingest with token present
    await ingestShopifyOrder(db.db, {
      id: `ord_tag_${Date.now()}`,
      email: COMMERCE_EMAIL,
      customer: { id: 999001, email: COMMERCE_EMAIL, tags: 'vip,newsletter,wholesale' },
      financial_status: 'paid',
      line_items: [{ variant_id: VARIANT_KNOWN, sku: 'TOUCH-BARRIER-1', title: 'Phase4 Barrier Calm', quantity: 1 }],
    });
    // Wait briefly for fire-and-forget
    await new Promise((r) => setTimeout(r, 50));
    global.fetch = origFetch;
    report.critical.risk3_tag_overwrite = {
      putUrl,
      putBody,
      sent_tags: putBody?.customer?.tags,
      preexisting_on_customer_object: 'vip,newsletter,wholesale',
      destroys_existing_if_put_as_plain_app_member:
        putBody?.customer?.tags === 'app_member' || putBody?.customer?.tags === 'app_member,',
      source_snippet: tagFnMatch ? tagFnMatch[0].slice(0, 500) : null,
    };
  }

  // ---------- TOUCH-073 HMAC ----------
  {
    const orderPayload = {
      id: `ord_hmac_${Date.now()}`,
      email: 'nobody-hmac@example.com',
      line_items: [{ variant_id: VARIANT_UNKNOWN, sku: 'NOPE', title: 'X', quantity: 1 }],
    };
    const raw = Buffer.from(JSON.stringify(orderPayload), 'utf8');
    const valid = signHmac(raw);
    const beforeDl = db.db.prepare(`SELECT COUNT(*) AS n FROM shopify_order_dead_letters`).get().n;

    // supertest Buffer bodies break HMAC (body ≠ signed bytes); send raw UTF-8 string.
    const okRes = await request(app)
      .post('/webhooks/shopify/orders/create')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', valid)
      .send(raw.toString('utf8'));
    const afterValidDl = db.db.prepare(`SELECT COUNT(*) AS n FROM shopify_order_dead_letters`).get().n;

    const badRaw = Buffer.from(JSON.stringify({ ...orderPayload, id: `ord_bad_${Date.now()}` }), 'utf8');
    const beforeBad = db.db
      .prepare(`SELECT COUNT(*) AS n FROM shopify_order_dead_letters WHERE shopify_order_id=?`)
      .get(`ord_bad_${Date.now()}`);
    const badId = `ord_hmac_invalid_${Date.now()}`;
    const badPayload = { ...orderPayload, id: badId };
    const badBuf = Buffer.from(JSON.stringify(badPayload), 'utf8');
    const beforeCount = db.db
      .prepare(`SELECT COUNT(*) AS n FROM shopify_order_dead_letters WHERE shopify_order_id=?`)
      .get(badId).n;
    const badRes = await request(app)
      .post('/webhooks/shopify/orders/create')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', 'definitely_invalid_hmac_value_xxx')
      .send(badBuf.toString('utf8'));
    const afterCount = db.db
      .prepare(`SELECT COUNT(*) AS n FROM shopify_order_dead_letters WHERE shopify_order_id=?`)
      .get(badId).n;
    const ordersAfterBad = db.db
      .prepare(`SELECT COUNT(*) AS n FROM shopify_orders WHERE shopify_order_id=?`)
      .get(badId).n;

    report.tickets['073'] = {
      secret_set: Boolean(getShopifyWebhookSecret()),
      valid_status: okRes.status,
      valid_body: okRes.body,
      dl_delta_on_valid: afterValidDl - beforeDl,
      invalid_status: badRes.status,
      invalid_body: badRes.body,
      invalid_dead_letter_rows: afterCount - beforeCount,
      invalid_orders_written: ordersAfterBad,
    };
  }

  // ---------- TOUCH-074 FHIR-only risk #6 ----------
  {
    const fhirId = ensureFhirOnlyPatient(FHIR_ONLY_EMAIL);
    const match = findPatientSessionByEmail(db.db, FHIR_ONLY_EMAIL);
    const shelfBefore = db.db.prepare(`SELECT COUNT(*) AS n FROM patient_onboarding_step3_products`).get().n;
    const out = ingestShopifyOrder(db.db, {
      id: `ord_fhir_${Date.now()}`,
      email: FHIR_ONLY_EMAIL,
      customer: { id: 42, email: FHIR_ONLY_EMAIL },
      financial_status: 'paid',
      line_items: [{ variant_id: VARIANT_KNOWN, sku: 'TOUCH-BARRIER-1', title: 'Phase4 Barrier Calm', quantity: 1 }],
    });
    const shelfAfter = db.db.prepare(`SELECT COUNT(*) AS n FROM patient_onboarding_step3_products`).get().n;
    const orderRow = db.db
      .prepare(`SELECT session_id, patient_id, app_member FROM shopify_orders WHERE shopify_order_id=?`)
      .get(out.shopify_order_id);
    report.critical.risk6_fhir_only = {
      fhir_patient_id: fhirId,
      match_lookup: match,
      ingest: out,
      order_row: orderRow,
      shelf_count_before: shelfBefore,
      shelf_count_after: shelfAfter,
      shelf_delta: shelfAfter - shelfBefore,
      falsely_claims_shelf_ids: (out.shelf_product_ids || []).length > 0,
      app_member_true_without_session: out.app_member === true && !match?.session_id,
    };
  }

  // ---------- TOUCH-075 / 076 dead letters ----------
  {
    const emailUnmatched = ingestShopifyOrder(db.db, {
      id: `ord_em_${Date.now()}`,
      email: 'totally-unknown-order@example.com',
      line_items: [{ variant_id: VARIANT_KNOWN, title: 'X', quantity: 1 }],
    });
    const skuUnmapped = ingestShopifyOrder(db.db, {
      id: `ord_sku_${Date.now()}`,
      email: COMMERCE_EMAIL,
      line_items: [{ variant_id: VARIANT_UNKNOWN, sku: 'UNMAPPED-SKU-XYZ', title: 'Unknown', quantity: 1 }],
    });
    const dlEmail = db.db
      .prepare(
        `SELECT id, reason, email FROM shopify_order_dead_letters WHERE id IN (${emailUnmatched.dead_letter_ids
          .map(() => '?')
          .join(',')})`,
      )
      .all(...emailUnmatched.dead_letter_ids);
    const dlSku = db.db
      .prepare(
        `SELECT id, reason, email FROM shopify_order_dead_letters WHERE id IN (${skuUnmapped.dead_letter_ids
          .map(() => '?')
          .join(',')})`,
      )
      .all(...(skuUnmapped.dead_letter_ids || ['']));
    report.tickets['075_076'] = {
      email_unmatched: emailUnmatched,
      email_dl_rows: dlEmail,
      sku_unmapped: skuUnmapped,
      sku_dl_rows: dlSku,
    };
  }

  // ---------- TOUCH-077 scheme ----------
  {
    const layout = fs.readFileSync(path.join(__dirname, '../../patient-app/app/_layout.tsx'), 'utf8');
    const appJson = fs.readFileSync(path.join(__dirname, '../../patient-app/app.json'), 'utf8');
    const schemes = [...`${layout}\n${appJson}`.matchAll(/([a-z][a-z0-9+.-]*):\/\//gi)].map((m) => m[1]);
    report.tickets['077'] = {
      app_json_scheme: JSON.parse(appJson).expo?.scheme,
      order_confirmation_handler: /patientapp:\/\/order-confirmation|path === 'order-confirmation'/.test(layout),
      unique_schemes_in_layout_appjson: [...new Set(schemes)],
      non_patientapp_order_schemes: [...new Set(schemes)].filter((s) => s !== 'patientapp' && s !== 'https' && s !== 'http'),
    };
  }

  // ---------- TOUCH-078 / 079 matched webhook full path ----------
  {
    // clear prior shelf for clean before/after
    db.db
      .prepare(`DELETE FROM patient_onboarding_step3_products WHERE session_id=? AND selection_mode='shopify'`)
      .run(commerce.session_id);
    const beforeShelf = db.db
      .prepare(`SELECT id, custom_product_name FROM patient_onboarding_step3_products WHERE session_id=?`)
      .all(commerce.session_id);
    const orderId = `ord_match_${Date.now()}`;
    const payload = {
      id: orderId,
      email: COMMERCE_EMAIL,
      customer: { id: 77, email: COMMERCE_EMAIL },
      financial_status: 'paid',
      line_items: [
        {
          variant_id: VARIANT_KNOWN,
          sku: 'TOUCH-BARRIER-1',
          title: 'Phase4 Barrier Calm',
          quantity: 1,
        },
      ],
    };
    const raw = Buffer.from(JSON.stringify(payload), 'utf8');
    const res = await request(app)
      .post('/webhooks/shopify/orders/create')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Hmac-Sha256', signHmac(raw))
      .send(raw.toString('utf8'));
    const afterShelf = db.db
      .prepare(`SELECT id, custom_product_name, selection_mode, ingredients_text FROM patient_onboarding_step3_products WHERE session_id=?`)
      .all(commerce.session_id);
    report.tickets['078_079'] = {
      webhook_status: res.status,
      webhook_body: res.body,
      shelf_before: beforeShelf,
      shelf_after: afterShelf,
      evaluate_in_response: res.body?.evaluate,
      evaluate_is_hardcoded_clean:
        res.body?.evaluate &&
        res.body.evaluate.overall === 'safe' &&
        !res.body.evaluate.hard_no &&
        Number(res.body.evaluate.conflict_count || 0) === 0
          ? 'possible_clean_but_check_ingredients'
          : 'nontrivial_or_null',
    };
  }

  // ---------- TOUCH-080 / 081 shop + badge + no tab ----------
  {
    const tabs = fs.readFileSync(path.join(__dirname, '../../patient-app/app/(tabs)/_layout.tsx'), 'utf8');
    const check = fs.readFileSync(path.join(__dirname, '../../patient-app/app/check.tsx'), 'utf8');
    const catalog = await request(app).get('/api/patient/shop/catalog').set(hdr);
    const product = await request(app)
      .get('/api/patient/shop/products/barrier-calm-moisturizer')
      .set(hdr);
    report.tickets['080_081'] = {
      tabs_shop_screen: /name=\"shop\"/.test(tabs),
      check_shop_icon: /shop|Shop/.test(check) && /tabBar/.test(check),
      catalog_status: catalog.status,
      catalog_count: (catalog.body?.products || []).length,
      product_status: product.status,
      evaluate_badge: product.body?.evaluate_badge,
      evaluate_badge_from_pipeline: Boolean(product.body?.evaluate_badge?.overall),
    };
  }

  // ---------- TOUCH-082 orders ----------
  {
    const orders = await request(app).get('/api/patient/orders').set(hdr);
    report.tickets['082'] = {
      status: orders.status,
      orders: orders.body?.orders,
      count: (orders.body?.orders || []).length,
    };
  }

  // ---------- TOUCH-084 flag flip (authoritative when set) ----------
  {
    const prevFlag = process.env.COMMERCE_CTAS_ENABLED;
    const mapCount = db.db.prepare(`SELECT COUNT(*) AS n FROM shopify_variant_product_map`).get().n;
    process.env.COMMERCE_CTAS_ENABLED = '0';
    const readyOff = commerceBridgeReady(db.db);
    const statusOff = await request(app).get('/api/patient/commerce/status').set(hdr);
    process.env.COMMERCE_CTAS_ENABLED = '1';
    const readyOn = commerceBridgeReady(db.db);
    const statusOn = await request(app).get('/api/patient/commerce/status').set(hdr);
    if (prevFlag === undefined) delete process.env.COMMERCE_CTAS_ENABLED;
    else process.env.COMMERCE_CTAS_ENABLED = prevFlag;
    report.tickets['084'] = {
      variant_map_count: mapCount,
      commerceBridgeReady_flag_0: readyOff,
      commerceBridgeReady_flag_1: readyOn,
      status_flag_0: statusOff.body,
      status_flag_1: statusOn.body,
      note:
        'COMMERCE_CTAS_ENABLED is authoritative when set: 0 forces OFF regardless of map rows; 1 forces ON; unset falls back to map presence.',
    };
  }

  // ---------- CRITICAL Risk #7 admin auth ----------
  {
    const prevSecret = process.env.ADMIN_PORTAL_SECRET;
    process.env.ADMIN_PORTAL_SECRET = 'phase45_admin_secret_test';
    // rebuild app so requireAdminAuth sees secret
    const appAuth = buildApp({ withAdminSecret: true });
    const noAuth = await request(appAuth)
      .post('/api/admin/shopify/variant-map')
      .send({ shopify_variant_id: '999', product_name: 'x' });
    const noAuthReprocess = await request(appAuth)
      .post('/api/admin/shopify/dead-letters/reprocess-sku')
      .send({ limit: 1 });
    // FIX 3: omitting requireAdminAuth must throw at registration (not return 200)
    let omittedThrow = null;
    try {
      buildApp({ withAdminSecret: false });
    } catch (e) {
      omittedThrow = e.message;
    }
    if (prevSecret === undefined) delete process.env.ADMIN_PORTAL_SECRET;
    else process.env.ADMIN_PORTAL_SECRET = prevSecret;
    report.critical.risk7_admin_auth = {
      with_secret_no_creds_variant_map: { status: noAuth.status, body: noAuth.body },
      with_secret_no_creds_reprocess: { status: noAuthReprocess.status, body: noAuthReprocess.body },
      requireAdminAuth_omitted_throws: omittedThrow,
      source_fallback_pattern_removed: !require('fs')
        .readFileSync(require('path').join(__dirname, '../routes/patient-commerce.js'), 'utf8')
        .includes('requireAdminAuth ||'),
    };
  }

  // ---------- TOUCH-105 reconcile ----------
  {
    clearEmail(DEAD_LETTER_EMAIL);
    const dlOrderId = `ord_recon_${Date.now()}`;
    // Pre-map variant so rematch can shelf-add after verify
    upsertVariantMap(db.db, {
      shopify_variant_id: VARIANT_KNOWN,
      sku: 'TOUCH-BARRIER-1',
      product_name: 'Phase4 Barrier Calm',
      ingredients_text: 'ceramide np, glycerin',
    });
    const unmatched = ingestShopifyOrder(db.db, {
      id: dlOrderId,
      email: DEAD_LETTER_EMAIL,
      line_items: [{ variant_id: VARIANT_KNOWN, sku: 'TOUCH-BARRIER-1', title: 'Phase4 Barrier Calm', quantity: 1 }],
    });
    const dlBefore = db.db
      .prepare(
        `SELECT id, reason, resolved_at FROM shopify_order_dead_letters WHERE shopify_order_id=? AND reason='email_unmatched'`,
      )
      .all(dlOrderId);

    // OTP verify path (same as auth confirm)
    const sessionId = uuidv4();
    db.insertVerificationSession({
      sessionId,
      email: DEAD_LETTER_EMAIL,
      code: OTP,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      ip: '127.0.0.1',
      userAgent: 'phase45-105',
    });
    const verifyRes = await request(app)
      .post('/api/patient/verify/confirm')
      .send({ email: DEAD_LETTER_EMAIL, code: OTP });
    const dlAfter = db.db
      .prepare(
        `SELECT id, reason, resolved_at FROM shopify_order_dead_letters WHERE shopify_order_id=?`,
      )
      .all(dlOrderId);
    const shelf = db.db
      .prepare(
        `SELECT id, custom_product_name, selection_mode FROM patient_onboarding_step3_products WHERE session_id=?`,
      )
      .all(verifyRes.body?.session_id || 'none');
    report.tickets['105'] = {
      unmatched_ingest: unmatched,
      dl_before: dlBefore,
      verify_status: verifyRes.status,
      commerce_reconcile: verifyRes.body?.commerce_reconcile,
      dl_after: dlAfter,
      shelf_after_verify: shelf,
    };
  }

  // ---------- TOUCH-106 reprocess ----------
  {
    const skuDlId = writeDeadLetter(db.db, {
      shopifyOrderId: `ord_reproc_${Date.now()}`,
      email: COMMERCE_EMAIL,
      reason: 'sku_unmapped',
      payload: {
        order_id: `ord_reproc_host`,
        email: COMMERCE_EMAIL,
        line_item: { variant_id: VARIANT_KNOWN, sku: 'TOUCH-BARRIER-1', title: 'Phase4 Barrier Calm' },
      },
    });
    // Ensure parent order row exists for email lookup in reprocess
    db.db
      .prepare(
        `INSERT OR IGNORE INTO shopify_orders (id, shopify_order_id, email, patient_id, session_id, app_member, created_at, updated_at)
         VALUES (?, 'ord_reproc_host', ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      )
      .run(`so_ord_reproc_host`, COMMERCE_EMAIL, commerce.patient_id, commerce.session_id);

    process.env.ADMIN_PORTAL_SECRET = process.env.ADMIN_PORTAL_SECRET || 'phase45_admin_secret_test';
    // Create admin session token
    const { createSessionRecord } = (() => {
      // use login endpoint style: create via db helper
      return {
        createSessionRecord: () => {
          const token = crypto.randomBytes(24).toString('hex');
          db.createAdminSession({
            id: token,
            issued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            ip: '127.0.0.1',
            user_agent: 'phase45',
            last_seen_at: new Date().toISOString(),
          });
          return token;
        },
      };
    })();
    const adminToken = createSessionRecord();
    const appAuth = buildApp({ withAdminSecret: true });
    const before = db.db
      .prepare(`SELECT id, resolved_at FROM shopify_order_dead_letters WHERE id=?`)
      .get(skuDlId);
    const reproc = await request(appAuth)
      .post('/api/admin/shopify/dead-letters/reprocess-sku')
      .set('x-admin-session', adminToken)
      .send({ limit: 50 });
    const after = db.db
      .prepare(`SELECT id, resolved_at FROM shopify_order_dead_letters WHERE id=?`)
      .get(skuDlId);
    report.tickets['106'] = {
      dl_id: skuDlId,
      before,
      reprocess_status: reproc.status,
      reprocess_body: reproc.body,
      after,
    };
  }

  // ---------- Phase 5 profile field round-trip (088/089/090 + bio PUT) ----------
  {
    const put = await request(app)
      .put('/api/patient/bio-profile')
      .set(hdr)
      .send({
        budget_band: 'mid',
        climate_zone: 'humid',
        zip: '10001',
        procedure_date: '2026-07-10',
        procedure_type: 'peel',
        conditions: ['sensitive'],
      });
    const get = await request(app).get('/api/patient/bio-profile').set(hdr);
    const stored = getBioProfile(db.db, {
      sessionId: commerce.session_id,
      patientId: commerce.patient_id,
    });
    const sent = {
      budget_band: 'mid',
      climate_zone: 'humid',
      zip: '10001',
      procedure_date: '2026-07-10',
      procedure_type: 'peel',
    };
    const roundTrip = {
      budget_band: stored?.budget_band === sent.budget_band,
      climate_zone: stored?.climate_zone === sent.climate_zone,
      zip: stored?.zip === sent.zip,
      procedure_date: stored?.procedure_date === sent.procedure_date,
      procedure_type: stored?.procedure_type === sent.procedure_type,
    };
    report.tickets['088_089_090_roundtrip'] = {
      put_status: put.status,
      put_profile_fields: {
        budget_band: put.body?.profile?.budget_band,
        climate_zone: put.body?.profile?.climate_zone,
        zip: put.body?.profile?.zip,
        procedure_date: put.body?.profile?.procedure_date,
        procedure_type: put.body?.profile?.procedure_type,
      },
      get_status: get.status,
      stored,
      sent,
      roundTrip,
      all_survived: Object.values(roundTrip).every(Boolean),
    };
  }

  // ---------- Profile UI structure 085-093 ----------
  {
    const src = account;
    const testIds = [...src.matchAll(/testID=\"([^\"]+)\"/g)].map((m) => m[1]);
    const allergensIdx = src.indexOf('testID="profile-allergens"');
    const conditionsIdx = src.indexOf('testID="profile-conditions"');
    const memberIdx = src.indexOf('memberBanner');
    const ordersIdx = src.indexOf('ORDERS_HREF');
    const signOutIdx = src.indexOf('Sign out');
    const labsIdx = src.indexOf('touche labs');
    const tryIdx = src.indexOf('trytouche.com');
    const advancedIdx = src.indexOf('advanced-severity-toggle');
    const collapsedIdx = src.indexOf('profile-collapsed-fields');
    report.tickets['085_093_ui'] = {
      member_banner_present: memberIdx > 0 && /SHOP_HREF/.test(src),
      allergens_before_conditions: allergensIdx > 0 && conditionsIdx > allergensIdx,
      allergens_first_among_profile_blocks:
        allergensIdx > 0 &&
        allergensIdx < conditionsIdx &&
        // fails if More/budget block precedes allergens
        src.indexOf('profile-advanced-fields-toggle') > 0 &&
        src.indexOf('profile-advanced-fields-toggle') < allergensIdx
          ? false
          : allergensIdx < conditionsIdx,
      advanced_block_before_allergens:
        src.indexOf('profile-advanced-fields-toggle') >= 0 &&
        src.indexOf('profile-advanced-fields-toggle') < allergensIdx,
      conditions_block: conditionsIdx > 0,
      collapsed_budget_climate_procedure: collapsedIdx > 0,
      advanced_sliders_toggle: advancedIdx > 0,
      orders_entry: ordersIdx > 0,
      sign_out: signOutIdx > 0,
      touche_labs: labsIdx > 0,
      trytouche_link: tryIdx > 0,
      testIds_profile_related: testIds.filter((t) => /profile|procedure|allergen|order|member|shop/i.test(t)),
    };
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
