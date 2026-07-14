'use strict';

/**
 * TOUCH-073–079 + 105/106 — Shopify order ingest → member match → shelf → dead-letters.
 */

const { ensurePatientShelfInventoryColumns, formatShelfProductApiRow } = require('../lib/patient-shelf-api');

function ensureCommerceTables(db) {
  require('../migrations/063_shopify_commerce').up(db);
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function findPatientSessionByEmail(db, email) {
  const e = normalizeEmail(email);
  if (!e) return null;
  // Prefer active portal session
  try {
    const portal = db
      .prepare(
        `SELECT id AS session_id, patient_id, email FROM patient_portal_sessions
         WHERE LOWER(email) = ? AND verified = 1
         ORDER BY datetime(expires_at) DESC LIMIT 1`,
      )
      .get(e);
    if (portal) return portal;
  } catch (_) {}
  try {
    const sess = db
      .prepare(
        `SELECT session_id, patient_id, email FROM patient_sessions
         WHERE LOWER(email) = ?
         ORDER BY datetime(expires_at) DESC LIMIT 1`,
      )
      .get(e);
    if (sess) return sess;
  } catch (_) {}
  try {
    const fhir = db
      .prepare(
        `SELECT resource_id AS patient_id, email FROM fhir_patients
         WHERE LOWER(email) = ? AND (is_deleted IS NULL OR is_deleted = 0)
         ORDER BY datetime(created_at) DESC LIMIT 1`,
      )
      .get(e);
    if (fhir) return { session_id: null, patient_id: fhir.patient_id, email: fhir.email };
  } catch (_) {}
  return null;
}

function writeDeadLetter(db, { shopifyOrderId, email, reason, payload }) {
  ensureCommerceTables(db);
  const id = `sdl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO shopify_order_dead_letters (id, shopify_order_id, email, payload_json, reason, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).run(id, String(shopifyOrderId || 'unknown'), normalizeEmail(email) || null, JSON.stringify(payload || {}), reason);
  return id;
}

function upsertVariantMap(db, row) {
  ensureCommerceTables(db);
  const variantId = String(row.shopify_variant_id || row.variant_id || '').trim();
  if (!variantId) throw new Error('shopify_variant_id required');
  db.prepare(
    `INSERT INTO shopify_variant_product_map (
       shopify_variant_id, sku, catalog_product_id, product_name, product_handle, brand, ingredients_text, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(shopify_variant_id) DO UPDATE SET
       sku = excluded.sku,
       catalog_product_id = excluded.catalog_product_id,
       product_name = excluded.product_name,
       product_handle = excluded.product_handle,
       brand = excluded.brand,
       ingredients_text = excluded.ingredients_text,
       updated_at = datetime('now')`,
  ).run(
    variantId,
    row.sku ? String(row.sku) : null,
    row.catalog_product_id ? String(row.catalog_product_id) : null,
    String(row.product_name || row.title || 'Product'),
    row.product_handle ? String(row.product_handle) : null,
    row.brand ? String(row.brand) : null,
    row.ingredients_text ? String(row.ingredients_text) : null,
  );
  return variantId;
}

function lookupVariant(db, variantId, sku) {
  ensureCommerceTables(db);
  if (variantId) {
    const byId = db
      .prepare(`SELECT * FROM shopify_variant_product_map WHERE shopify_variant_id = ?`)
      .get(String(variantId));
    if (byId) return byId;
  }
  if (sku) {
    return db.prepare(`SELECT * FROM shopify_variant_product_map WHERE sku = ? LIMIT 1`).get(String(sku));
  }
  return null;
}

function addMappedProductToShelf(db, { sessionId, patientId, mapped, quantity = 1 }) {
  if (!sessionId) return null;
  ensurePatientShelfInventoryColumns();
  const name = mapped.product_name || 'Product';
  const existing = db
    .prepare(
      `SELECT id FROM patient_onboarding_step3_products
       WHERE session_id = ? AND custom_product_name = ? LIMIT 1`,
    )
    .get(sessionId, name);
  if (existing) return existing.id;

  const { extractActivesFromText, persistCanonicalIds } = require('./patient-lineup-resolver-service');
  const ids = extractActivesFromText(`${name} ${mapped.ingredients_text || ''}`);
  const id = `shelf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  db.prepare(
    `INSERT INTO patient_onboarding_step3_products (
      id, session_id, patient_id, selection_mode, catalog_product_id, custom_product_name, custom_brand,
      category, usage_time, goal, key_ingredients, ingredients_text, ingredient_canonical_ids_json
    ) VALUES (?, ?, ?, 'shopify', ?, ?, ?, 'treatment', 'pm', 'conflict_track', ?, ?, ?)`,
  ).run(
    id,
    sessionId,
    patientId || null,
    mapped.catalog_product_id || mapped.shopify_variant_id || null,
    name,
    mapped.brand || null,
    mapped.ingredients_text ? String(mapped.ingredients_text).slice(0, 2000) : null,
    mapped.ingredients_text || null,
    JSON.stringify(ids),
  );
  persistCanonicalIds(db, id, ids);
  void quantity;
  return id;
}

/**
 * Ingest Shopify orders/create payload.
 * @returns {{ success, matched, app_member, shelf_product_ids, dead_letter_ids, evaluate }}
 */
function ingestShopifyOrder(db, payload) {
  ensureCommerceTables(db);
  const order = payload || {};
  const shopifyOrderId = String(order.id || order.admin_graphql_api_id || '').trim();
  if (!shopifyOrderId) {
    throw new Error('shopify_order_id_required');
  }

  const email = normalizeEmail(order.email || order.customer?.email);
  const match = findPatientSessionByEmail(db, email);
  const deadLetters = [];
  const shelfIds = [];

  if (!email || !match || (!match.session_id && !match.patient_id)) {
    const dl = writeDeadLetter(db, {
      shopifyOrderId,
      email,
      reason: 'email_unmatched',
      payload: order,
    });
    deadLetters.push(dl);
    return {
      success: true,
      matched: false,
      app_member: false,
      shelf_product_ids: [],
      dead_letter_ids: deadLetters,
      shopify_order_id: shopifyOrderId,
    };
  }

  // Persist order
  db.prepare(
    `INSERT INTO shopify_orders (
       id, shopify_order_id, email, patient_id, session_id, app_member, financial_status, payload_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(shopify_order_id) DO UPDATE SET
       patient_id = COALESCE(excluded.patient_id, shopify_orders.patient_id),
       session_id = COALESCE(excluded.session_id, shopify_orders.session_id),
       app_member = 1,
       financial_status = excluded.financial_status,
       payload_json = excluded.payload_json,
       updated_at = datetime('now')`,
  ).run(
    `so_${shopifyOrderId}`,
    shopifyOrderId,
    email,
    match.patient_id || null,
    match.session_id || null,
    order.financial_status || null,
    JSON.stringify(order),
  );

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  for (const li of lineItems) {
    const variantId = String(li.variant_id || li.variantId || '').trim();
    const sku = String(li.sku || '').trim();
    const mapped = lookupVariant(db, variantId, sku);
    const lineId = `sol_${shopifyOrderId}_${variantId || sku || Math.random().toString(36).slice(2, 6)}`;

    if (!mapped) {
      const dl = writeDeadLetter(db, {
        shopifyOrderId,
        email,
        reason: 'sku_unmapped',
        payload: { line_item: li, order_id: shopifyOrderId },
      });
      deadLetters.push(dl);
      db.prepare(
        `INSERT OR IGNORE INTO shopify_order_line_items (
           id, shopify_order_id, shopify_variant_id, sku, title, quantity, mapped, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
      ).run(lineId, shopifyOrderId, variantId || null, sku || null, li.title || null, Number(li.quantity) || 1);
      continue;
    }

    let shelfId = null;
    if (match.session_id) {
      shelfId = addMappedProductToShelf(db, {
        sessionId: match.session_id,
        patientId: match.patient_id,
        mapped: { ...mapped, shopify_variant_id: variantId || mapped.shopify_variant_id },
        quantity: Number(li.quantity) || 1,
      });
      if (shelfId) shelfIds.push(shelfId);
    }

    db.prepare(
      `INSERT OR REPLACE INTO shopify_order_line_items (
         id, shopify_order_id, shopify_variant_id, sku, title, quantity, shelf_product_id, mapped, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    ).run(
      lineId,
      shopifyOrderId,
      variantId || mapped.shopify_variant_id,
      sku || mapped.sku,
      li.title || mapped.product_name,
      Number(li.quantity) || 1,
      shelfId,
    );
  }

  let evaluate = null;
  if (match.session_id && shelfIds.length) {
    try {
      const { runEvaluatePipelineSync } = require('./consumer-evaluate-nodes');
      evaluate = runEvaluatePipelineSync(db, {
        sessionId: match.session_id,
        patientId: match.patient_id,
      });
    } catch (_) {
      evaluate = null;
    }
  }

  // Optional Shopify customer tag — fire-and-forget stub when token present.
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN && order.customer?.id) {
    void tagShopifyCustomerAppMember(order.customer.id).catch(() => {});
  }

  return {
    success: true,
    matched: true,
    app_member: true,
    shelf_product_ids: shelfIds,
    dead_letter_ids: deadLetters,
    shopify_order_id: shopifyOrderId,
    evaluate: evaluate
      ? {
          overall: evaluate.overall,
          hard_no: evaluate.hard_no,
          conflict_count: (evaluate.conflicts || []).length,
          hero_subtitle: evaluate.hero_subtitle,
        }
      : null,
  };
}

/** Parse Shopify customer tags string → unique trimmed list. */
function parseShopifyTags(raw) {
  return [
    ...new Set(
      String(raw || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * TOUCH-074 — Merge app_member into existing tags (never blind-replace).
 * Decision: GET current tags → dedupe-merge `app_member` → PUT merged CSV.
 */
function mergeAppMemberTags(existingTagsRaw) {
  const merged = parseShopifyTags(existingTagsRaw);
  if (!merged.some((t) => t.toLowerCase() === 'app_member')) {
    merged.push('app_member');
  }
  return merged.join(', ');
}

async function tagShopifyCustomerAppMember(customerId) {
  const shop = String(process.env.SHOPIFY_SHOP_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!shop || !token || !customerId) return null;
  const url = `https://${shop}/admin/api/2024-01/customers/${customerId}.json`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': token,
  };

  let existingRaw = '';
  try {
    const getRes = await fetch(url, { method: 'GET', headers });
    if (getRes.ok) {
      const data = await getRes.json();
      existingRaw = data?.customer?.tags || '';
    }
  } catch (_) {
    // If GET fails, still PUT app_member alone rather than inventing foreign tags.
    existingRaw = '';
  }

  const tags = mergeAppMemberTags(existingRaw);
  await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ customer: { id: customerId, tags } }),
  });
  return tags;
}

/** TOUCH-105 — resolve email_unmatched dead letters for this email after signup. */
function reconcileDeadLettersForEmail(db, { email, sessionId, patientId }) {
  ensureCommerceTables(db);
  const e = normalizeEmail(email);
  if (!e) return { resolved: 0, results: [] };
  const rows = db
    .prepare(
      `SELECT id, shopify_order_id, payload_json, reason FROM shopify_order_dead_letters
       WHERE resolved_at IS NULL AND LOWER(email) = ? AND reason = 'email_unmatched'
       ORDER BY datetime(created_at) ASC`,
    )
    .all(e);

  const results = [];
  for (const row of rows) {
    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch (_) {
      payload = {};
    }
    // Ensure email on payload for rematch
    payload.email = payload.email || e;
    const out = ingestShopifyOrder(db, payload);
    if (out.matched) {
      db.prepare(`UPDATE shopify_order_dead_letters SET resolved_at = datetime('now') WHERE id = ?`).run(row.id);
      results.push({ dead_letter_id: row.id, ...out });
    }
  }
  void sessionId;
  void patientId;
  return { resolved: results.length, results };
}

/** TOUCH-106 — reprocess sku_unmapped after map updates. */
function reprocessSkuUnmappedDeadLetters(db, { limit = 50 } = {}) {
  ensureCommerceTables(db);
  const rows = db
    .prepare(
      `SELECT id, shopify_order_id, payload_json FROM shopify_order_dead_letters
       WHERE resolved_at IS NULL AND reason = 'sku_unmapped'
       ORDER BY datetime(created_at) ASC LIMIT ?`,
    )
    .all(Math.min(200, Math.max(1, Number(limit) || 50)));

  const results = [];
  for (const row of rows) {
    let payload = {};
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch (_) {
      continue;
    }
    // Payload may be { line_item, order_id } — rebuild a mini order for ingest shelf path
    const line = payload.line_item || payload;
    const orderId = payload.order_id || row.shopify_order_id;
    const emailRow = db.prepare(`SELECT email FROM shopify_orders WHERE shopify_order_id = ?`).get(String(orderId));
    const email = normalizeEmail(payload.email || emailRow?.email);
    const match = findPatientSessionByEmail(db, email);
    const variantId = String(line.variant_id || '').trim();
    const sku = String(line.sku || '').trim();
    const mapped = lookupVariant(db, variantId, sku);
    if (!mapped || !match?.session_id) continue;

    const shelfId = addMappedProductToShelf(db, {
      sessionId: match.session_id,
      patientId: match.patient_id,
      mapped,
    });
    db.prepare(`UPDATE shopify_order_dead_letters SET resolved_at = datetime('now') WHERE id = ?`).run(row.id);
    results.push({ dead_letter_id: row.id, shelf_product_id: shelfId, shopify_order_id: orderId });
  }
  return { resolved: results.length, results };
}

function listOrdersForEmail(db, email) {
  ensureCommerceTables(db);
  const e = normalizeEmail(email);
  if (!e) return [];
  return db
    .prepare(
      `SELECT shopify_order_id, email, financial_status, app_member, created_at, updated_at
       FROM shopify_orders WHERE LOWER(email) = ? ORDER BY datetime(created_at) DESC LIMIT 50`,
    )
    .all(e);
}

function getOrderDetail(db, shopifyOrderId) {
  ensureCommerceTables(db);
  const order = db
    .prepare(`SELECT * FROM shopify_orders WHERE shopify_order_id = ?`)
    .get(String(shopifyOrderId));
  if (!order) return null;
  const lines = db
    .prepare(`SELECT * FROM shopify_order_line_items WHERE shopify_order_id = ?`)
    .all(String(shopifyOrderId));
  return { order, lines };
}

module.exports = {
  ensureCommerceTables,
  normalizeEmail,
  findPatientSessionByEmail,
  writeDeadLetter,
  upsertVariantMap,
  lookupVariant,
  addMappedProductToShelf,
  ingestShopifyOrder,
  parseShopifyTags,
  mergeAppMemberTags,
  tagShopifyCustomerAppMember,
  reconcileDeadLettersForEmail,
  reprocessSkuUnmappedDeadLetters,
  listOrdersForEmail,
  getOrderDetail,
  formatShelfProductApiRow,
};
