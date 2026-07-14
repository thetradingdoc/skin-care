'use strict';

/**
 * Targeted reprove for the three Phase 4/5 blocking fixes only.
 * Do not use this to re-claim other Phase 4/5 tickets.
 */

const assert = require('assert');
const express = require('express');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const request = require('supertest');

const {
  parseShopifyTags,
  mergeAppMemberTags,
  tagShopifyCustomerAppMember,
} = require('../services/shopify-order-ingest-service');
const { commerceBridgeReady } = require('../lib/shopify-hmac');
const { registerPatientCommerceRoutes } = require('../routes/patient-commerce');

async function main() {
  const report = { FIX1: null, FIX2: null, FIX3: null };

  // ----- FIX 1: tag merge -----
  assert.deepStrictEqual(parseShopifyTags('vip, newsletter, wholesale'), [
    'vip',
    'newsletter',
    'wholesale',
  ]);
  assert.strictEqual(
    mergeAppMemberTags('vip,newsletter,wholesale'),
    'vip, newsletter, wholesale, app_member',
  );
  assert.strictEqual(
    mergeAppMemberTags('vip, app_member, newsletter'),
    'vip, app_member, newsletter',
  );

  const calls = [];
  const prevFetch = global.fetch;
  global.fetch = async (url, opts = {}) => {
    calls.push({
      url: String(url),
      method: (opts.method || 'GET').toUpperCase(),
      body: opts.body,
    });
    if ((opts.method || 'GET').toUpperCase() === 'GET') {
      return {
        ok: true,
        json: async () => ({ customer: { id: 4242, tags: 'vip,newsletter,wholesale' } }),
      };
    }
    return {
      ok: true,
      json: async () => ({ customer: { id: 4242, tags: JSON.parse(opts.body).customer.tags } }),
    };
  };
  process.env.SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN || 'demo.myshopify.com';
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN =
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || 'shpat_test';
  const merged = await tagShopifyCustomerAppMember(4242);
  global.fetch = prevFetch;
  const put = calls.find((c) => c.method === 'PUT');
  const putTags = put ? JSON.parse(put.body).customer.tags : null;
  const tagSet = (putTags || '').split(',').map((s) => s.trim()).filter(Boolean);
  report.FIX1 = {
    preexisting: 'vip,newsletter,wholesale',
    sequence: calls.map((c) => c.method),
    put_tags: putTags,
    returned: merged,
    all_original_plus_app_member: ['vip', 'newsletter', 'wholesale', 'app_member'].every((t) =>
      tagSet.includes(t),
    ),
    pass:
      calls[0]?.method === 'GET' &&
      calls.some((c) => c.method === 'PUT') &&
      ['vip', 'newsletter', 'wholesale', 'app_member'].every((t) => tagSet.includes(t)) &&
      tagSet.length === 4,
  };
  assert.ok(report.FIX1.pass, 'FIX1 failed');

  // ----- FIX 2: flag override -----
  const dbPath = path.join(os.homedir(), 'middleware-dev.db');
  const raw = new Database(dbPath);
  require('../migrations/063_shopify_commerce').up(raw);
  const mapCount = raw.prepare(`SELECT COUNT(*) AS n FROM shopify_variant_product_map`).get().n;
  // Seed at least one row if empty so we prove kill-switch beats map presence
  if (Number(mapCount) === 0) {
    raw
      .prepare(
        `INSERT INTO shopify_variant_product_map
         (shopify_variant_id, product_name, ingredients_text, updated_at)
         VALUES ('prove_fix2_variant', 'Prove Fix2 Seed', 'water', datetime('now'))`,
      )
      .run();
  }
  const mapCountAfter = raw.prepare(`SELECT COUNT(*) AS n FROM shopify_variant_product_map`).get().n;

  const prevFlag = process.env.COMMERCE_CTAS_ENABLED;
  process.env.COMMERCE_CTAS_ENABLED = '0';
  const readyOff = commerceBridgeReady(raw);
  process.env.COMMERCE_CTAS_ENABLED = '1';
  const readyOn = commerceBridgeReady(raw);

  // Also hit status route shape
  const app = express();
  app.use(express.json());
  const dbFacade = { db: raw };
  registerPatientCommerceRoutes(app, {
    apiLimiter: (_r, _s, n) => n(),
    express,
    db: dbFacade,
    requirePatientSession: (req, _res, next) => {
      req.patientSession = { patientId: 1 };
      next();
    },
    requireAdminAuth: (_r, _s, n) => n(),
    resolvePatientIdFromSession: () => 1,
    recordPatientPortalEvent: () => {},
  });
  process.env.COMMERCE_CTAS_ENABLED = '0';
  const statusOff = await request(app).get('/api/patient/commerce/status');
  process.env.COMMERCE_CTAS_ENABLED = '1';
  const statusOn = await request(app).get('/api/patient/commerce/status');
  if (prevFlag === undefined) delete process.env.COMMERCE_CTAS_ENABLED;
  else process.env.COMMERCE_CTAS_ENABLED = prevFlag;

  report.FIX2 = {
    map_count: mapCountAfter,
    commerceBridgeReady_flag_0: readyOff,
    commerceBridgeReady_flag_1: readyOn,
    status_flag_0: statusOff.body,
    status_flag_1: statusOn.body,
    pass:
      Number(mapCountAfter) > 0 &&
      readyOff === false &&
      readyOn === true &&
      statusOff.body?.commerce_ctas_enabled === false &&
      statusOn.body?.commerce_ctas_enabled === true,
  };
  assert.ok(report.FIX2.pass, 'FIX2 failed');
  raw.close();

  // ----- FIX 3: no passthrough -----
  let threw = null;
  try {
    const openApp = express();
    registerPatientCommerceRoutes(openApp, {
      apiLimiter: (_r, _s, n) => n(),
      express,
      db: dbFacade,
      requirePatientSession: (_r, _s, n) => n(),
      resolvePatientIdFromSession: () => 1,
      recordPatientPortalEvent: () => {},
      // requireAdminAuth omitted on purpose
    });
  } catch (e) {
    threw = e.message;
  }
  const src = require('fs').readFileSync(
    path.join(__dirname, '../routes/patient-commerce.js'),
    'utf8',
  );
  report.FIX3 = {
    omitted_throws: !!threw,
    message: threw,
    source_has_passthrough_or: /requireAdminAuth\s*\|\|/.test(src),
    pass: !!threw && threw.includes('refusing silent passthrough') && !/requireAdminAuth\s*\|\|/.test(src),
  };
  assert.ok(report.FIX3.pass, 'FIX3 failed');

  console.log(JSON.stringify(report, null, 2));
  console.log('\nALL THREE FIXES: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
