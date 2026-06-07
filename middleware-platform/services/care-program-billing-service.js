'use strict';

const { v4: uuidv4 } = require('uuid');
const { getStripeSecretKey } = require('../utils/stripe-config');
const { ensureBillingTables } = require('../database/billing-tables');

function resolveCareProgramPricing() {
  return {
    monthly_price_cents: Number(process.env.CARE_PROGRAM_MONTHLY_CENTS || 4900),
    currency: 'USD',
    description: 'Skin & Care guided program subscription'
  };
}

function careProgramPriceId() {
  return String(process.env.STRIPE_PRICE_CARE_PROGRAM || '').trim() || null;
}

function portalBaseUrl() {
  const base =
    process.env.PATIENT_APP_URL ||
    process.env.BASE_URL ||
    process.env.API_BASE_URL ||
    'https://api.callsomo.com';
  return String(base).replace(/\/$/, '');
}

function getStripeClient() {
  const stripe = require('stripe');
  return stripe(getStripeSecretKey());
}

/**
 * Create Stripe Checkout session for care_program subscription.
 */
async function createCareProgramCheckout(opts = {}) {
  const sessionId = String(opts.sessionId || '').trim();
  const patientId = opts.patientId ? String(opts.patientId).trim() : null;
  const email = String(opts.email || '').trim();
  const concernId = opts.concernId ? String(opts.concernId).trim() : null;

  if (!sessionId) {
    throw new Error('sessionId is required');
  }
  if (!email) {
    throw new Error('email is required for checkout');
  }

  const priceId = careProgramPriceId();
  if (!priceId) {
    throw new Error('STRIPE_PRICE_CARE_PROGRAM is not configured');
  }

  const stripe = getStripeClient();
  const successUrl = opts.successUrl || 'patientapp://subscription/success';
  const cancelUrl = opts.cancelUrl || 'patientapp://subscription/cancel';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      type: 'care_program',
      patient_session_id: sessionId,
      patient_id: patientId || '',
      concern_id: concernId || '',
    },
    subscription_data: {
      metadata: {
        type: 'care_program',
        patient_session_id: sessionId,
        patient_id: patientId || '',
        concern_id: concernId || '',
      },
    },
  });

  return {
    success: true,
    checkout_url: session.url,
    session_id: session.id,
  };
}

/**
 * Activate care_program tier after Stripe checkout.session.completed webhook.
 */
function activateCareProgramSubscription(dbModule, opts = {}) {
  const sqlite = dbModule?.db;
  if (!sqlite) {
    return { success: false, error: 'database_unavailable' };
  }

  const sessionId = String(opts.sessionId || '').trim();
  if (!sessionId) {
    return { success: false, error: 'sessionId is required' };
  }

  ensureBillingTables(sqlite);

  const patientId = opts.patientId ? String(opts.patientId).trim() : null;
  const now = new Date().toISOString();
  const metadata = {
    stripe_customer_id: opts.stripeCustomerId || null,
    stripe_subscription_id: opts.stripeSubscriptionId || null,
    concern_id: opts.concernId || null,
    activated_at: now,
  };

  const existing = sqlite
    .prepare(
      `
    SELECT id FROM patient_billing_subscriptions
    WHERE session_id = ? OR (patient_id IS NOT NULL AND patient_id = ?)
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `
    )
    .get(sessionId, patientId || sessionId);

  if (existing?.id) {
    sqlite
      .prepare(
        `
      UPDATE patient_billing_subscriptions
      SET tier = 'care_program',
          status = 'active',
          patient_id = COALESCE(?, patient_id),
          metadata_json = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `
      )
      .run(patientId, JSON.stringify(metadata), existing.id);
  } else {
    sqlite
      .prepare(
        `
      INSERT INTO patient_billing_subscriptions (
        id, session_id, patient_id, tier, status, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, 'care_program', 'active', ?, datetime('now'), datetime('now'))
    `
      )
      .run(uuidv4(), sessionId, patientId, JSON.stringify(metadata));
  }

  return { success: true, tier: 'care_program', session_id: sessionId };
}

module.exports = {
  resolveCareProgramPricing,
  createCareProgramCheckout,
  activateCareProgramSubscription,
};
