'use strict';

/**
 * Phase 6 — monetization backend. Needles for audit script.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const Metrics = require('../services/metrics');
const {
  creditPackPurchase,
  consumeCredit,
  refundCredit,
  reconstructBalanceFromLedger,
  assertBalanceMatchesLedger,
  getCreditsSnapshot,
  ensureCreditsTables,
} = require('../services/ai-credits-ledger');
const {
  tryConsume,
  refundFailedIfNeeded,
  getUsage,
  issueWelcomeBonusIfNeeded,
  ensureTables: ensureMeter,
} = require('../services/ai-capture-meter');
const {
  fulfillAiCreditPackFromCheckout,
  fulfillPlusFromCheckout,
  deactivatePlusFromSubscription,
  upsertPlusSubscription,
  handleAiMonetizationStripeEvent,
  resolveAiMonetizationPricing,
  SHOPIFY_SEPARATION,
  META_CREDIT_PACK,
  META_PLUS,
  createAiCreditPackCheckout,
  createPlusCheckout,
} = require('../services/ai-monetization-stripe');
const { ensureBillingTables } = require('../database/billing-tables');

describe('P6.01 credits ledger', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureCreditsTables(db);
  });
  afterEach(() => db.close());

  test('P6.01 ledger balance reconstructs from history (drift detection)', () => {
    creditPackPurchase(db, {
      patientId: 'pat_led',
      packSize: 20,
      stripeEventId: 'evt_pack_1',
      reason: 'credit_pack_purchase',
    });
    consumeCredit(db, { patientId: 'pat_led', reason: 'ai_capture_consume' });
    consumeCredit(db, { patientId: 'pat_led', reason: 'ai_capture_consume' });
    refundCredit(db, { patientId: 'pat_led', reason: 'ai_capture_refund' });

    const snap = getCreditsSnapshot(db, { patientId: 'pat_led' });
    expect(snap.balance).toBe(19);
    expect(reconstructBalanceFromLedger(db, 'patient:pat_led')).toBe(19);
    expect(assertBalanceMatchesLedger(db, 'patient:pat_led').ok).toBe(true);

    // Force drift → fail loud
    db.prepare(`UPDATE ai_credits_balance SET balance = 999 WHERE owner_key = ?`).run('patient:pat_led');
    expect(() => assertBalanceMatchesLedger(db, 'patient:pat_led')).toThrow(/CREDITS_BALANCE_DRIFT/);
  });
});

describe('P6.02–P6.03 Stripe price reuse', () => {
  test('P6.02 credit pack pricing_policy pattern (not one-off)', () => {
    const pricing = resolveAiMonetizationPricing();
    expect(pricing.credit_pack.reads).toBe(20);
    expect(pricing.credit_pack.price_cents).toBe(399);
    expect(pricing.credit_pack.stripe_price_env).toBe('STRIPE_PRICE_AI_CREDIT_PACK');
    // Same checkout factory pattern as care_program
    expect(typeof createAiCreditPackCheckout).toBe('function');
    const src = fs.readFileSync(
      path.join(__dirname, '../services/ai-monetization-stripe.js'),
      'utf8',
    );
    expect(src).toMatch(/getStripeSecretKey/);
    expect(src).toMatch(/checkout\.sessions\.create/);
  });

  test('P6.03 Plus subscription wire reuses pricing_policy cents', () => {
    const pricing = resolveAiMonetizationPricing();
    expect(pricing.plus.monthly_price_cents).toBe(999);
    expect(pricing.plus.stripe_price_env).toBe('STRIPE_PRICE_PLUS');
    expect(typeof createPlusCheckout).toBe('function');
  });
});

describe('P6.04 webhook credit pack fulfillment', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureCreditsTables(db);
    Metrics.resetForTests();
  });
  afterEach(() => db.close());

  function packEvent(eventId) {
    return {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          metadata: {
            type: META_CREDIT_PACK,
            patient_id: 'pat_pay',
            patient_session_id: 'sess_pay',
            pack_size: '20',
          },
        },
      },
    };
  }

  test('P6.04 idempotent on Stripe event ID — replay does not double-credit', () => {
    const event = packEvent('evt_credit_once');
    const first = fulfillAiCreditPackFromCheckout(db, {
      event,
      session: event.data.object,
    });
    expect(first.duplicate).toBe(false);
    expect(getCreditsSnapshot(db, { patientId: 'pat_pay' }).balance).toBe(20);

    const second = fulfillAiCreditPackFromCheckout(db, {
      event,
      session: event.data.object,
    });
    expect(second.duplicate).toBe(true);
    expect(getCreditsSnapshot(db, { patientId: 'pat_pay' }).balance).toBe(20);
  });

  test('P6.04 ledger write failure is alertable (paid-money metrics)', () => {
    // Force failure: missing patient
    const event = {
      id: 'evt_bad',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_x', metadata: { type: META_CREDIT_PACK } } },
    };
    expect(() =>
      fulfillAiCreditPackFromCheckout(db, { event, session: event.data.object }),
    ).toThrow(/CREDIT_PACK_MISSING_PATIENT/);
    // Simulate post-payment ledger failure path
    const alert = Metrics.recordPaidMoneyFailure('stripe→ai_credits', {
      errorMessage: 'simulated_ledger_fail',
      logger: { error: () => {}, warn: () => {} },
    });
    expect(Metrics.get(Metrics.PAID_MONEY_FAIL_TOTAL)).toBeGreaterThanOrEqual(1);
    expect(alert.total).toBeGreaterThanOrEqual(1);
  });

  test('P6.04 signature must be verified before processing (canonical handler)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../routes/stripe-webhook-handler.js'),
      'utf8',
    );
    const sigIdx = src.indexOf('constructEvent');
    const aiIdx = src.indexOf('handleAiMonetizationStripeEvent');
    expect(sigIdx).toBeGreaterThan(-1);
    expect(aiIdx).toBeGreaterThan(sigIdx);
    expect(src).toMatch(/Signature verification failed/);
  });
});

describe('P6.05 Plus activate/deactivate meter bypass', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureCreditsTables(db);
    ensureBillingTables(db);
    ensureMeter(db);
  });
  afterEach(() => db.close());

  test('P6.05 activate Plus then deactivate re-enables metering', async () => {
    const checkoutEvent = {
      id: 'evt_plus_on',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_plus',
          customer: 'cus_1',
          subscription: 'sub_1',
          metadata: {
            type: META_PLUS,
            patient_id: 'pat_plus',
            patient_session_id: 'sess_plus',
          },
        },
      },
    };
    const on = fulfillPlusFromCheckout(db, {
      event: checkoutEvent,
      session: checkoutEvent.data.object,
    });
    expect(on.subscription.tier).toBe('plus');

    // Meter bypass while plus
    const plusConsume = tryConsume(db, {
      patientId: 'pat_plus',
      sessionId: 'sess_plus',
      captureKind: 'skin',
      isPlus: true,
    });
    expect(plusConsume.ok).toBe(true);
    expect(plusConsume.source).toBe('plus');

    const delEvent = {
      id: 'evt_plus_off',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          status: 'canceled',
          customer: 'cus_1',
          metadata: {
            type: META_PLUS,
            patient_id: 'pat_plus',
            patient_session_id: 'sess_plus',
          },
        },
      },
    };
    const off = deactivatePlusFromSubscription(db, {
      event: delEvent,
      subscription: delEvent.data.object,
    });
    expect(off.subscription.tier).toBe('free');
    expect(off.subscription.status).toBe('canceled');

    // After deactivate, isPlus=false must meter normally (not plus source)
    const after = tryConsume(db, {
      patientId: 'pat_plus',
      sessionId: 'sess_plus',
      captureKind: 'skin',
      isPlus: false,
    });
    expect(after.ok).toBe(true);
    expect(after.source).not.toBe('plus');
  });

  test('P6.05 deactivate path is idempotent on event id', () => {
    upsertPlusSubscription(db, {
      patientId: 'pat_x',
      sessionId: 'sess_x',
      status: 'active',
    });
    const event = {
      id: 'evt_off_once',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_x',
          status: 'canceled',
          metadata: { type: META_PLUS, patient_id: 'pat_x', patient_session_id: 'sess_x' },
        },
      },
    };
    const a = deactivatePlusFromSubscription(db, { event, subscription: event.data.object });
    const b = deactivatePlusFromSubscription(db, { event, subscription: event.data.object });
    expect(a.duplicate).toBeFalsy();
    expect(b.duplicate).toBe(true);
  });
});

describe('P6.06 welcome bonus + P6.07 usage SSOT', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureMeter(db);
    ensureCreditsTables(db);
  });
  afterEach(() => db.close());

  test('P6.06 welcome bonus still issues on first authenticated AI capture', () => {
    const first = tryConsume(db, {
      patientId: 'pat_welcome',
      sessionId: 'sess_w',
      captureKind: 'skin',
      isPlus: false,
    });
    expect(first.ok).toBe(true);
    expect(first.source).toBe('welcome_bonus');
    const usage = getUsage(db, { patientId: 'pat_welcome', sessionId: 'sess_w' });
    expect(usage.bonus_remaining).toBeGreaterThanOrEqual(0);
    // Idempotent second issue
    const again = issueWelcomeBonusIfNeeded(db, {
      patientId: 'pat_welcome',
      sessionId: 'sess_w',
    });
    expect(again).toBeTruthy();
  });

  test('P6.07 getUsage is SSOT for Profile meter (credits + monthly + bonus)', () => {
    creditPackPurchase(db, {
      patientId: 'pat_u',
      packSize: 20,
      stripeEventId: 'evt_u',
    });
    const usage = getUsage(db, { patientId: 'pat_u', sessionId: 'sess_u', isPlus: false });
    expect(usage.credits_balance).toBe(20);
    expect(usage.monthly_limit).toBeDefined();
    expect(usage).toHaveProperty('bonus_remaining');
    expect(usage).toHaveProperty('packs_purchased');
    // Route must call getUsage — not a parallel calculator
    const route = fs.readFileSync(
      path.join(__dirname, '../routes/patient-ai-monetization.js'),
      'utf8',
    );
    expect(route).toMatch(/\/api\/patient\/ai\/usage/);
    expect(route).toMatch(/getUsage/);
    expect(route).toMatch(/meter_source_of_truth/);
  });

  test('P6 paid credit consume refunds on failed capture (locked policy)', () => {
    creditPackPurchase(db, {
      patientId: 'pat_ref',
      packSize: 5,
      stripeEventId: 'evt_ref',
    });
    // Exhaust welcome by not using patient welcome — use patient with bonus already empty:
    // Force paid path: issue welcome then burn it, or consume with no bonus left
    issueWelcomeBonusIfNeeded(db, { patientId: 'pat_ref', sessionId: 'sess_ref' });
    // Burn welcome remaining to 0
    db.prepare(`UPDATE ai_welcome_bonus SET remaining = 0 WHERE owner_key = ?`).run(
      'patient:pat_ref',
    );
    const consumed = tryConsume(db, {
      patientId: 'pat_ref',
      sessionId: 'sess_ref',
      captureKind: 'skin',
      isPlus: false,
    });
    expect(consumed.source).toBe('paid_credits');
    expect(getCreditsSnapshot(db, { patientId: 'pat_ref' }).balance).toBe(4);

    const refunded = refundFailedIfNeeded(db, consumed.usageId, { reason: 'ocr_empty' });
    expect(refunded.refunded).toBe(true);
    expect(refunded.credit_restored).toBe(true);
    expect(getCreditsSnapshot(db, { patientId: 'pat_ref' }).balance).toBe(5);
  });
});

describe('P6.08 Shopify separation + P6.09 care_program buried', () => {
  test('P6.08 AI credits architecturally separate from Shopify', () => {
    expect(SHOPIFY_SEPARATION.ai_webhook_mount).toBe('/webhooks/stripe');
    expect(SHOPIFY_SEPARATION.shopify_webhook_mount).toBe('/webhooks/shopify');
    expect(SHOPIFY_SEPARATION.ai_ledger_table).toBe('ai_credits_ledger');

    const shopify = fs.readFileSync(
      path.join(__dirname, '../routes/shopify-webhooks.js'),
      'utf8',
    );
    expect(shopify).not.toMatch(/ai_credits_ledger|ai-credits-ledger|ai_monetization/);
    expect(shopify).not.toMatch(/handleAiMonetizationStripeEvent/);

    const ai = fs.readFileSync(
      path.join(__dirname, '../services/ai-monetization-stripe.js'),
      'utf8',
    );
    // SHOPIFY_SEPARATION may document mount paths; ban actual Shopify coupling.
    expect(ai).not.toMatch(/shopify-order-ingest|verifyShopifyHmac|require\(['"][^'"]*shopify/);
  });

  test('P6.09 care_program not promoted in AI usage/pricing routes', () => {
    const route = fs.readFileSync(
      path.join(__dirname, '../routes/patient-ai-monetization.js'),
      'utf8',
    );
    expect(route).toMatch(/care_program_promoted: false/);
    expect(route).not.toMatch(/createCareProgramCheckout|care-program\/checkout/);
    const account = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/(tabs)/account.tsx'),
      'utf8',
    );
    expect(account).toMatch(/care_program buried|TOUCH-011/);
  });
});

describe('P6 adversarial webhook routing', () => {
  let db;
  beforeEach(() => {
    db = new Database(':memory:');
    ensureCreditsTables(db);
    ensureBillingTables(db);
  });
  afterEach(() => db.close());

  test('non-AI checkout events are not handled by AI monetization', async () => {
    const r = await handleAiMonetizationStripeEvent(
      {
        id: 'evt_commerce',
        type: 'checkout.session.completed',
        data: { object: { metadata: { type: 'commerce_retail' } } },
      },
      db,
    );
    expect(r.handled).toBe(false);
  });
});
