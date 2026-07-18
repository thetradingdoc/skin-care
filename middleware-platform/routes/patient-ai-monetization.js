'use strict';

/**
 * P6.02–P6.07 — Patient AI monetization routes (usage + checkouts).
 * Separate from Shopify commerce and SaaS /api/credits.
 */

const {
  createAiCreditPackCheckout,
  createPlusCheckout,
  resolveAiMonetizationPricing,
  SHOPIFY_SEPARATION,
} = require('../services/ai-monetization-stripe');
const { getUsage, issueWelcomeBonusIfNeeded } = require('../services/ai-capture-meter');

function registerPatientAiMonetizationRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    resolveBillingSubscription,
  } = deps;

  function resolveIsPlus(req) {
    if (typeof resolveBillingSubscription === 'function') {
      return resolveBillingSubscription(req)?.tier === 'plus';
    }
    return false;
  }

  /**
   * P6.07 — Same SSOT as tryConsume (getUsage + subscription tier).
   */
  app.get(
    '/api/patient/ai/usage',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const isPlus = resolveIsPlus(req);
        if (patientId) {
          try {
            issueWelcomeBonusIfNeeded(db.db, { patientId, sessionId });
          } catch (_) {}
        }
        const usage = getUsage(db.db, { patientId, sessionId, isPlus });
        const pricing = resolveAiMonetizationPricing();
        return res.json({
          success: true,
          usage,
          meter_source_of_truth: 'ai-capture-meter.getUsage',
          pricing,
          shopify_separation: {
            ai_webhook: SHOPIFY_SEPARATION.ai_webhook_mount,
            shopify_webhook: SHOPIFY_SEPARATION.shopify_webhook_mount,
          },
          // P6.09 — care_program is not surfaced here
          care_program_promoted: false,
        });
      } catch (e) {
        return res.status(500).json({
          success: false,
          error_code: e.code || 'USAGE_FAILED',
          error: e.message,
        });
      }
    },
  );

  app.get(
    '/api/patient/ai/pricing',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      return res.json({
        success: true,
        pricing: resolveAiMonetizationPricing(),
        care_program_promoted: false,
      });
    },
  );

  app.post(
    '/api/patient/ai/credits/checkout',
    apiLimiter,
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const email = String(req.body?.email || req.patientSession?.email || '').trim();
        if (!email) {
          return res.status(400).json({ success: false, error_code: 'EMAIL_REQUIRED' });
        }
        const out = await createAiCreditPackCheckout({
          sessionId,
          patientId,
          email,
          successUrl: req.body?.success_url,
          cancelUrl: req.body?.cancel_url,
        });
        return res.json(out);
      } catch (e) {
        const status = e.code === 'STRIPE_PRICE_NOT_CONFIGURED' ? 503 : 400;
        return res.status(status).json({
          success: false,
          error_code: e.code || 'CHECKOUT_FAILED',
          error: e.message,
        });
      }
    },
  );

  app.post(
    '/api/patient/ai/plus/checkout',
    apiLimiter,
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const email = String(req.body?.email || req.patientSession?.email || '').trim();
        if (!email) {
          return res.status(400).json({ success: false, error_code: 'EMAIL_REQUIRED' });
        }
        const out = await createPlusCheckout({
          sessionId,
          patientId,
          email,
          successUrl: req.body?.success_url,
          cancelUrl: req.body?.cancel_url,
        });
        return res.json(out);
      } catch (e) {
        const status = e.code === 'STRIPE_PRICE_NOT_CONFIGURED' ? 503 : 400;
        return res.status(status).json({
          success: false,
          error_code: e.code || 'CHECKOUT_FAILED',
          error: e.message,
        });
      }
    },
  );
}

module.exports = { registerPatientAiMonetizationRoutes };
