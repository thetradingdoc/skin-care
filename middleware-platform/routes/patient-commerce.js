'use strict';

/**
 * TOUCH-080–082 / 084 / 106 — Shop catalog, orders, commerce flag, ops resolve.
 */

const { listShopCatalog, getShopProduct } = require('../lib/touche-shop-catalog');
const { commerceBridgeReady } = require('../lib/shopify-hmac');
const {
  listOrdersForEmail,
  getOrderDetail,
  upsertVariantMap,
  reprocessSkuUnmappedDeadLetters,
  ensureCommerceTables,
} = require('../services/shopify-order-ingest-service');
const { runEvaluatePipelineSync } = require('../services/consumer-evaluate-nodes');

function requireAdminAuthOrThrow(requireAdminAuth) {
  if (typeof requireAdminAuth !== 'function') {
    throw new Error(
      'registerPatientCommerceRoutes: requireAdminAuth dependency is required (refusing silent passthrough)',
    );
  }
  return requireAdminAuth;
}

function registerPatientCommerceRoutes(app, deps) {
  const { apiLimiter, express, db, requirePatientSession, requireAdminAuth } = deps;
  const adminAuth = requireAdminAuthOrThrow(requireAdminAuth);

  app.get('/api/patient/commerce/status', apiLimiter, requirePatientSession, (req, res) => {
    try {
      ensureCommerceTables(db.db);
      const ready = commerceBridgeReady(db.db);
      return res.json({
        success: true,
        commerce_ctas_enabled: ready,
        store_origin: (process.env.STORE_ORIGIN || 'https://trytouche.com').replace(/\/$/, ''),
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/patient/shop/catalog', apiLimiter, requirePatientSession, (req, res) => {
    try {
      return res.json({ success: true, products: listShopCatalog() });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/patient/shop/products/:handle', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const product = getShopProduct(req.params.handle);
      if (!product) return res.status(404).json({ success: false, error: 'not_found' });

      const sessionId = req.patientSessionId;
      const patientId = req.patientSession?.patient_id || null;
      let evaluate_badge = null;
      try {
        // Evaluate shelf as-is; badge = hypothetical "matches shelf" via hard_no/caution on name blob.
        const evalRes = runEvaluatePipelineSync(db.db, { sessionId, patientId });
        const blob = `${product.product_name} ${product.ingredients_text}`.toLowerCase();
        const hard = (evalRes.hard_no_hits || []).some((h) =>
          blob.includes(String(h.allergen_class || '').replace(/_/g, ' ')),
        );
        evaluate_badge = {
          overall: hard ? 'hard_no' : evalRes.overall || 'safe',
          label: hard ? 'Hard no for you' : evalRes.overall === 'caution' ? 'Use with care' : 'Matches shelf',
          acrylate_free_verified: Boolean(evalRes.acrylate_free_verified),
        };
      } catch (_) {
        evaluate_badge = { overall: 'unknown', label: 'Check after add' };
      }

      return res.json({ success: true, product, evaluate_badge });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/patient/orders', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const email = req.patientSession?.email || null;
      const orders = listOrdersForEmail(db.db, email);
      return res.json({ success: true, orders });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/patient/orders/:orderId', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const detail = getOrderDetail(db.db, req.params.orderId);
      if (!detail) return res.status(404).json({ success: false, error: 'not_found' });
      const email = String(req.patientSession?.email || '').toLowerCase();
      if (email && detail.order.email && String(detail.order.email).toLowerCase() !== email) {
        return res.status(404).json({ success: false, error: 'not_found' });
      }
      return res.json({ success: true, ...detail });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  // TOUCH-076 seed / ops map upsert (admin only — no passthrough fallback)
  app.post(
    '/api/admin/shopify/variant-map',
    apiLimiter,
    adminAuth,
    express.json(),
    (req, res) => {
      try {
        const body = req.body || {};
        const items = Array.isArray(body.items) ? body.items : [body];
        const ids = items.map((it) => upsertVariantMap(db.db, it));
        return res.json({ success: true, upserted: ids });
      } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
      }
    },
  );

  // TOUCH-106
  app.post(
    '/api/admin/shopify/dead-letters/reprocess-sku',
    apiLimiter,
    adminAuth,
    express.json(),
    (req, res) => {
      try {
        const out = reprocessSkuUnmappedDeadLetters(db.db, { limit: req.body?.limit });
        return res.json({ success: true, ...out });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientCommerceRoutes, requireAdminAuthOrThrow };
