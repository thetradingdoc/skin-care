'use strict';

/**
 * TOUCH-073 — Shopify orders/create webhook (raw body + HMAC).
 */

const express = require('express');
const { verifyShopifyHmac } = require('../lib/shopify-hmac');
const { ingestShopifyOrder, ensureCommerceTables } = require('../services/shopify-order-ingest-service');

function createShopifyWebhookRouter(db) {
  const router = express.Router();

  router.post(
    '/orders/create',
    express.raw({ type: '*/*', limit: '2mb' }),
    (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
        const hmac = req.headers['x-shopify-hmac-sha256'];
        if (!verifyShopifyHmac(raw, hmac)) {
          return res.status(401).json({ success: false, error: 'invalid_hmac' });
        }

        let payload;
        try {
          payload = JSON.parse(raw.toString('utf8'));
        } catch (_) {
          return res.status(400).json({ success: false, error: 'invalid_json' });
        }

        ensureCommerceTables(db.db);
        const result = ingestShopifyOrder(db.db, payload);
        return res.status(200).json({ success: true, ...result });
      } catch (e) {
        console.error('shopify orders/create error', e);
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  return router;
}

module.exports = { createShopifyWebhookRouter };
