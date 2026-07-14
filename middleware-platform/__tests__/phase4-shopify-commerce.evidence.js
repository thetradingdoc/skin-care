'use strict';

/**
 * Phase 4 commerce evidence — HMAC, ingest, shelf, dead-letter, reconcile, sku resolve.
 * Run: node __tests__/phase4-shopify-commerce.evidence.js
 */

const assert = require('assert');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { verifyShopifyHmac } = require('../lib/shopify-hmac');
const {
  ensureCommerceTables,
  upsertVariantMap,
  ingestShopifyOrder,
  reconcileDeadLettersForEmail,
  reprocessSkuUnmappedDeadLetters,
  writeDeadLetter,
} = require('../services/shopify-order-ingest-service');
const { buildShopifyCartUrl, buildShopifyPdpUrl } = (() => {
  // Mirror client builders for contract
  const ORIGIN = 'https://trytouche.com';
  return {
    buildShopifyCartUrl: (id) => {
      const url = `${ORIGIN}/cart/${encodeURIComponent(id)}:1?discount=JOURNAL20`;
      assert.ok(url.includes('/cart/'));
      return url;
    },
    buildShopifyPdpUrl: (h) => `${ORIGIN}/products/${encodeURIComponent(h)}?discount=JOURNAL20`,
  };
})();

// TOUCH-069/070
assert.ok(buildShopifyCartUrl('123').includes('/cart/123:1'));
assert.ok(buildShopifyPdpUrl('barrier-calm').includes('/products/barrier-calm'));

// HMAC
{
  process.env.SHOPIFY_WEBHOOK_SECRET = 'test_secret';
  const body = Buffer.from(JSON.stringify({ id: 1 }), 'utf8');
  const good = crypto.createHmac('sha256', 'test_secret').update(body).digest('base64');
  assert.strictEqual(verifyShopifyHmac(body, good), true);
  assert.strictEqual(verifyShopifyHmac(body, 'bad'), false);
}

const db = new Database(':memory:');
ensureCommerceTables(db);
db.exec(`
  CREATE TABLE patient_portal_sessions (
    id TEXT PRIMARY KEY, patient_id TEXT, email TEXT, verified INTEGER, expires_at TEXT
  );
  CREATE TABLE patient_onboarding_step3_products (
    id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, selection_mode TEXT,
    catalog_product_id TEXT, custom_product_name TEXT, custom_brand TEXT,
    category TEXT, usage_time TEXT, goal TEXT, key_ingredients TEXT, ingredients_text TEXT,
    ingredient_canonical_ids_json TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
`);

db.prepare(
  `INSERT INTO patient_portal_sessions (id, patient_id, email, verified, expires_at)
   VALUES ('ps1', 'pat1', 'member@example.com', 1, datetime('now','+1 day'))`,
).run();

upsertVariantMap(db, {
  shopify_variant_id: '999001',
  sku: 'BARRIER-1',
  product_name: 'Barrier Calm Moisturizer',
  product_handle: 'barrier-calm-moisturizer',
  ingredients_text: 'ceramide np, glycerin',
});

// Unmatched → dead letter (TOUCH-075)
const unmatched = ingestShopifyOrder(db, {
  id: 'ord_unmatched',
  email: 'ghost@example.com',
  line_items: [{ variant_id: '999001', title: 'Barrier Calm', quantity: 1 }],
});
assert.strictEqual(unmatched.matched, false);
assert.ok(unmatched.dead_letter_ids.length >= 1);

// Matched + mapped → shelf (TOUCH-074/078)
const matched = ingestShopifyOrder(db, {
  id: 'ord_match',
  email: 'member@example.com',
  financial_status: 'paid',
  line_items: [{ variant_id: '999001', sku: 'BARRIER-1', title: 'Barrier Calm', quantity: 1 }],
});
assert.strictEqual(matched.matched, true);
assert.strictEqual(matched.app_member, true);
assert.ok(matched.shelf_product_ids.length >= 1);
const shelf = db
  .prepare(`SELECT custom_product_name FROM patient_onboarding_step3_products WHERE session_id = 'ps1'`)
  .get();
assert.ok(shelf?.custom_product_name);

// sku_unmapped dead letter (TOUCH-076)
const unmapped = ingestShopifyOrder(db, {
  id: 'ord_sku',
  email: 'member@example.com',
  line_items: [{ variant_id: 'nope', sku: 'UNKNOWN', title: 'Mystery', quantity: 1 }],
});
assert.ok(unmapped.dead_letter_ids.length >= 1);

// Reconcile email unmatched (TOUCH-105)
db.prepare(
  `INSERT INTO patient_portal_sessions (id, patient_id, email, verified, expires_at)
   VALUES ('ps2', 'pat2', 'ghost@example.com', 1, datetime('now','+1 day'))`,
).run();
upsertVariantMap(db, {
  shopify_variant_id: '999001',
  product_name: 'Barrier Calm Moisturizer',
});
const recon = reconcileDeadLettersForEmail(db, {
  email: 'ghost@example.com',
  sessionId: 'ps2',
  patientId: 'pat2',
});
assert.ok(recon.resolved >= 1);

// Reprocess sku after map (TOUCH-106)
upsertVariantMap(db, {
  shopify_variant_id: 'nope',
  sku: 'UNKNOWN',
  product_name: 'Mystery Cream',
});
const reproc = reprocessSkuUnmappedDeadLetters(db, { limit: 10 });
assert.ok(reproc.resolved >= 1);
const stillOpen = db
  .prepare(
    `SELECT COUNT(*) AS n FROM shopify_order_dead_letters WHERE reason = 'sku_unmapped' AND resolved_at IS NULL`,
  )
  .get();
assert.strictEqual(Number(stillOpen.n), 0);

console.log('phase4-shopify-commerce.evidence: PASS');
