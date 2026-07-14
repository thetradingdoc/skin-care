'use strict';

/**
 * TOUCH-073 — Shopify webhook HMAC (sha256 of raw body).
 */

const crypto = require('crypto');

function getShopifyWebhookSecret() {
  return String(process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || '').trim();
}

function verifyShopifyHmac(rawBody, hmacHeader) {
  const secret = getShopifyWebhookSecret();
  if (!secret) {
    // Dev convenience: allow when secret unset AND not production.
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') {
      return false;
    }
    return true;
  }
  if (!hmacHeader || rawBody == null) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(digest);
  const b = Buffer.from(String(hmacHeader).trim());
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

/**
 * TOUCH-084 — Commerce CTA readiness.
 * Decision: COMMERCE_CTAS_ENABLED is authoritative when set.
 *   - "0"/"false"/"no" → force OFF (kill-switch), ignore map rows
 *   - "1"/"true"/"yes" → force ON (and seed catalog map)
 *   - unset/empty → fall back to map presence (dev convenience only)
 */
function commerceBridgeReady(db) {
  require('../migrations/063_shopify_commerce').up(db);
  const flag = String(process.env.COMMERCE_CTAS_ENABLED || '').toLowerCase().trim();

  if (flag === '0' || flag === 'false' || flag === 'no') {
    return false;
  }

  if (flag === '1' || flag === 'true' || flag === 'yes') {
    // Seed catalog variants so cart permalinks resolve when flag flipped on.
    try {
      const { upsertVariantMap } = require('../services/shopify-order-ingest-service');
      const { CATALOG } = require('./touche-shop-catalog');
      for (const p of CATALOG) {
        upsertVariantMap(db, {
          shopify_variant_id: p.shopify_variant_id,
          product_name: p.product_name,
          product_handle: p.handle,
          brand: p.brand,
          ingredients_text: p.ingredients_text,
        });
      }
    } catch (_) {}
    return true;
  }

  try {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM shopify_variant_product_map`).get();
    return Number(row?.n || 0) > 0;
  } catch (_) {
    return false;
  }
}

module.exports = {
  getShopifyWebhookSecret,
  verifyShopifyHmac,
  commerceBridgeReady,
};
