'use strict';

/**
 * P6.02–P6.05 — Patient AI monetization (credit packs + Plus) via existing Stripe patterns.
 * Reuses care-program checkout shape + canonical /webhooks/stripe signature verify.
 * Architecturally separate from Shopify commerce and SaaS /api/credits (voice minutes).
 */

const { v4: uuidv4 } = require('uuid');
const { getStripeSecretKey } = require('../utils/stripe-config');
const { ensureBillingTables } = require('../database/billing-tables');
const {
  creditPackPurchase,
  ensureCreditsTables,
} = require('./ai-credits-ledger');
const Metrics = require('./metrics');

const AI_CREDIT_PACK_SIZE = Math.max(1, Number(process.env.AI_CREDIT_PACK_SIZE || 20));
const AI_CREDIT_PACK_PRICE_CENTS = Math.max(1, Number(process.env.AI_CREDIT_PACK_PRICE_CENTS || 399));
const PLUS_MONTHLY_CENTS = Math.max(1, Number(process.env.PLUS_MONTHLY_PRICE_CENTS || 999));

/** Metadata types — never overlap Shopify or care_program fulfillment. */
const META_CREDIT_PACK = 'ai_credit_pack';
const META_PLUS = 'plus';

function resolveAiMonetizationPricing() {
  return {
    currency: 'USD',
    credit_pack: {
      reads: AI_CREDIT_PACK_SIZE,
      price_cents: AI_CREDIT_PACK_PRICE_CENTS,
      stripe_price_env: 'STRIPE_PRICE_AI_CREDIT_PACK',
    },
    plus: {
      monthly_price_cents: PLUS_MONTHLY_CENTS,
      stripe_price_env: 'STRIPE_PRICE_PLUS',
      unlimited_ai: true,
    },
  };
}

function creditPackPriceId() {
  return String(process.env.STRIPE_PRICE_AI_CREDIT_PACK || '').trim() || null;
}

function plusPriceId() {
  return String(process.env.STRIPE_PRICE_PLUS || '').trim() || null;
}

function getStripeClient() {
  const stripe = require('stripe');
  return stripe(getStripeSecretKey());
}

function portalUrls(opts) {
  return {
    successUrl: opts.successUrl || 'patientapp://ai/credits/success',
    cancelUrl: opts.cancelUrl || 'patientapp://ai/credits/cancel',
  };
}

/**
 * P6.02 — Checkout for 20-read credit pack ($3.99).
 */
async function createAiCreditPackCheckout(opts = {}) {
  const sessionId = String(opts.sessionId || '').trim();
  const patientId = opts.patientId ? String(opts.patientId).trim() : null;
  const email = String(opts.email || '').trim();
  if (!sessionId) throw new Error('sessionId is required');
  if (!patientId) throw new Error('patientId is required');
  if (!email) throw new Error('email is required for checkout');

  const priceId = creditPackPriceId();
  if (!priceId) {
    const err = new Error('STRIPE_PRICE_AI_CREDIT_PACK is not configured');
    err.code = 'STRIPE_PRICE_NOT_CONFIGURED';
    throw err;
  }

  const { successUrl, cancelUrl } = portalUrls(opts);
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: META_CREDIT_PACK,
      patient_session_id: sessionId,
      patient_id: patientId,
      pack_size: String(AI_CREDIT_PACK_SIZE),
    },
  });

  return {
    success: true,
    checkout_url: session.url,
    session_id: session.id,
    pack_size: AI_CREDIT_PACK_SIZE,
    pricing: resolveAiMonetizationPricing().credit_pack,
  };
}

/**
 * P6.03 — Plus subscription checkout ($9.99/mo).
 */
async function createPlusCheckout(opts = {}) {
  const sessionId = String(opts.sessionId || '').trim();
  const patientId = opts.patientId ? String(opts.patientId).trim() : null;
  const email = String(opts.email || '').trim();
  if (!sessionId) throw new Error('sessionId is required');
  if (!patientId) throw new Error('patientId is required');
  if (!email) throw new Error('email is required for checkout');

  const priceId = plusPriceId();
  if (!priceId) {
    const err = new Error('STRIPE_PRICE_PLUS is not configured');
    err.code = 'STRIPE_PRICE_NOT_CONFIGURED';
    throw err;
  }

  const { successUrl, cancelUrl } = portalUrls(opts);
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || 'patientapp://ai/plus/success',
    cancel_url: cancelUrl || 'patientapp://ai/plus/cancel',
    metadata: {
      type: META_PLUS,
      patient_session_id: sessionId,
      patient_id: patientId,
    },
    subscription_data: {
      metadata: {
        type: META_PLUS,
        patient_session_id: sessionId,
        patient_id: patientId,
      },
    },
  });

  return {
    success: true,
    checkout_url: session.url,
    session_id: session.id,
    pricing: resolveAiMonetizationPricing().plus,
  };
}

function alreadyHandledEvent(db, stripeEventId) {
  ensureCreditsTables(db);
  return db
    .prepare(`SELECT stripe_event_id FROM ai_monetization_webhook_dedupe WHERE stripe_event_id = ?`)
    .get(stripeEventId);
}

function markEventHandled(db, { stripeEventId, eventType, handler, result }) {
  ensureCreditsTables(db);
  db.prepare(
    `INSERT OR IGNORE INTO ai_monetization_webhook_dedupe
      (stripe_event_id, event_type, handler, result_json)
     VALUES (?, ?, ?, ?)`,
  ).run(stripeEventId, eventType, handler, JSON.stringify(result || {}));
}

function upsertPlusSubscription(db, {
  patientId,
  sessionId,
  status,
  stripeCustomerId = null,
  stripeSubscriptionId = null,
  stripeEventId = null,
} = {}) {
  ensureBillingTables(db);
  if (!patientId && !sessionId) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }

  const existing = db
    .prepare(
      `SELECT * FROM patient_billing_subscriptions
       WHERE (patient_id IS NOT NULL AND patient_id = ?)
          OR (session_id IS NOT NULL AND session_id = ?)
       ORDER BY datetime(updated_at) DESC LIMIT 1`,
    )
    .get(patientId || null, sessionId || null);

  const meta = {
    ...(existing?.metadata_json ? JSON.parse(existing.metadata_json) : {}),
    stripe_customer_id: stripeCustomerId || undefined,
    stripe_subscription_id: stripeSubscriptionId || undefined,
    last_stripe_event_id: stripeEventId || undefined,
    type: META_PLUS,
  };

  const tier = status === 'active' || status === 'trialing' ? 'plus' : 'free';
  const subStatus = status === 'active' || status === 'trialing' ? 'active' : 'canceled';

  if (existing) {
    db.prepare(
      `UPDATE patient_billing_subscriptions SET
        tier = ?, status = ?, patient_id = COALESCE(?, patient_id),
        session_id = COALESCE(?, session_id),
        metadata_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      tier,
      subStatus,
      patientId || null,
      sessionId || null,
      JSON.stringify(meta),
      existing.id,
    );
    return { id: existing.id, tier, status: subStatus };
  }

  const id = `pbs_${uuidv4()}`;
  db.prepare(
    `INSERT INTO patient_billing_subscriptions
      (id, session_id, patient_id, tier, status, metadata_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
  ).run(id, sessionId || null, patientId || null, tier, subStatus, JSON.stringify(meta));
  return { id, tier, status: subStatus };
}

/**
 * Fulfill credit pack from verified Stripe event. Idempotent on event.id.
 * Ledger write failure → recordPaidMoneyFailure + throw (fail loud).
 */
function fulfillAiCreditPackFromCheckout(db, { event, session }) {
  const stripeEventId = event.id;
  if (alreadyHandledEvent(db, stripeEventId)) {
    return { handled: true, duplicate: true, kind: META_CREDIT_PACK };
  }

  const meta = session.metadata || {};
  const patientId = String(meta.patient_id || '').trim();
  const sessionId = String(meta.patient_session_id || '').trim() || null;
  const packSize = Number(meta.pack_size || AI_CREDIT_PACK_SIZE);

  if (!patientId) {
    const err = new Error('CREDIT_PACK_MISSING_PATIENT');
    err.code = 'CREDIT_PACK_MISSING_PATIENT';
    throw err;
  }

  try {
    const credited = creditPackPurchase(db, {
      patientId,
      sessionId,
      packSize,
      stripeEventId,
      stripeCheckoutSessionId: session.id,
      metadata: { payment_status: session.payment_status },
    });
    const result = { handled: true, duplicate: false, kind: META_CREDIT_PACK, credited };
    markEventHandled(db, {
      stripeEventId,
      eventType: event.type,
      handler: 'ai_credit_pack',
      result,
    });
    return result;
  } catch (e) {
    Metrics.recordPaidMoneyFailure('stripe→ai_credits', {
      errorMessage: e.message,
    });
    throw e;
  }
}

function fulfillPlusFromCheckout(db, { event, session }) {
  const stripeEventId = event.id;
  if (alreadyHandledEvent(db, stripeEventId)) {
    return { handled: true, duplicate: true, kind: META_PLUS };
  }

  const meta = session.metadata || {};
  const patientId = String(meta.patient_id || '').trim() || null;
  const sessionId = String(meta.patient_session_id || '').trim() || null;
  if (!patientId && !sessionId) {
    const err = new Error('PLUS_MISSING_OWNER');
    err.code = 'PLUS_MISSING_OWNER';
    throw err;
  }

  try {
    const sub = upsertPlusSubscription(db, {
      patientId,
      sessionId,
      status: 'active',
      stripeCustomerId: session.customer || null,
      stripeSubscriptionId: session.subscription || null,
      stripeEventId,
    });
    const result = { handled: true, duplicate: false, kind: META_PLUS, subscription: sub };
    markEventHandled(db, {
      stripeEventId,
      eventType: event.type,
      handler: 'plus_activate',
      result,
    });
    return result;
  } catch (e) {
    Metrics.recordPaidMoneyFailure('stripe→plus', { errorMessage: e.message });
    throw e;
  }
}

/**
 * P6.05 — Deactivate Plus (cancel / unpaid / deleted). Re-enables metering.
 */
function deactivatePlusFromSubscription(db, { event, subscription }) {
  const stripeEventId = event.id;
  if (alreadyHandledEvent(db, stripeEventId)) {
    return { handled: true, duplicate: true, kind: 'plus_deactivate' };
  }

  const meta = subscription.metadata || {};
  const patientId = String(meta.patient_id || '').trim() || null;
  const sessionId = String(meta.patient_session_id || '').trim() || null;
  const status = String(subscription.status || 'canceled');

  // Only deactivate when not active/trialing
  if (status === 'active' || status === 'trialing') {
    return { handled: false, reason: 'still_active' };
  }

  try {
    const sub = upsertPlusSubscription(db, {
      patientId,
      sessionId,
      status: 'canceled',
      stripeCustomerId: subscription.customer || null,
      stripeSubscriptionId: subscription.id || null,
      stripeEventId,
    });
    if (sub.tier !== 'free') {
      const err = new Error('PLUS_DEACTIVATE_DID_NOT_CLEAR_TIER');
      err.code = 'PLUS_DEACTIVATE_DID_NOT_CLEAR_TIER';
      throw err;
    }
    const result = { handled: true, duplicate: false, kind: 'plus_deactivate', subscription: sub };
    markEventHandled(db, {
      stripeEventId,
      eventType: event.type,
      handler: 'plus_deactivate',
      result,
    });
    return result;
  } catch (e) {
    Metrics.recordPaidMoneyFailure('stripe→plus', { errorMessage: e.message });
    throw e;
  }
}

/**
 * Entry from canonical Stripe webhook (signature already verified).
 * Returns { handled: false } if event is not AI monetization (voice/commerce continue).
 */
async function handleAiMonetizationStripeEvent(event, db) {
  if (!event || !db) return { handled: false };

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object || {};
    const type = String(session.metadata?.type || '');
    if (type === META_CREDIT_PACK) {
      return fulfillAiCreditPackFromCheckout(db, { event, session });
    }
    if (type === META_PLUS) {
      return fulfillPlusFromCheckout(db, { event, session });
    }
    return { handled: false };
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.updated'
  ) {
    const subscription = event.data?.object || {};
    const type = String(subscription.metadata?.type || '');
    if (type !== META_PLUS) return { handled: false };
    if (event.type === 'customer.subscription.deleted') {
      return deactivatePlusFromSubscription(db, { event, subscription });
    }
    // updated: deactivate when status leaves active/trialing
    const status = String(subscription.status || '');
    if (status === 'active' || status === 'trialing') {
      // Ensure still plus
      const patientId = String(subscription.metadata?.patient_id || '').trim() || null;
      const sessionId = String(subscription.metadata?.patient_session_id || '').trim() || null;
      if (alreadyHandledEvent(db, event.id)) {
        return { handled: true, duplicate: true };
      }
      const sub = upsertPlusSubscription(db, {
        patientId,
        sessionId,
        status: 'active',
        stripeCustomerId: subscription.customer || null,
        stripeSubscriptionId: subscription.id || null,
        stripeEventId: event.id,
      });
      markEventHandled(db, {
        stripeEventId: event.id,
        eventType: event.type,
        handler: 'plus_keep_active',
        result: { subscription: sub },
      });
      return { handled: true, kind: META_PLUS, subscription: sub };
    }
    return deactivatePlusFromSubscription(db, { event, subscription });
  }

  return { handled: false };
}

/** P6.08 — architectural markers for tests */
const SHOPIFY_SEPARATION = Object.freeze({
  ai_webhook_mount: '/webhooks/stripe',
  shopify_webhook_mount: '/webhooks/shopify',
  ai_ledger_table: 'ai_credits_ledger',
  shopify_must_not_touch: ['ai_credits_ledger', 'ai_credits_balance', 'ai_monetization_webhook_dedupe'],
  metadata_types: Object.freeze([META_CREDIT_PACK, META_PLUS]),
  care_program_not_primary: true,
});

module.exports = {
  META_CREDIT_PACK,
  META_PLUS,
  AI_CREDIT_PACK_SIZE,
  AI_CREDIT_PACK_PRICE_CENTS,
  resolveAiMonetizationPricing,
  creditPackPriceId,
  plusPriceId,
  createAiCreditPackCheckout,
  createPlusCheckout,
  fulfillAiCreditPackFromCheckout,
  fulfillPlusFromCheckout,
  deactivatePlusFromSubscription,
  upsertPlusSubscription,
  handleAiMonetizationStripeEvent,
  SHOPIFY_SEPARATION,
};
