'use strict';

const Database = require('better-sqlite3');
const { ensureBillingTables } = require('../database/billing-tables');
const { activateCareProgramSubscription } = require('../services/care-program-billing-service');

function handleCareProgramCheckoutCompleted(dbModule, checkoutSession) {
  if (
    checkoutSession.mode !== 'subscription' ||
    !checkoutSession.metadata ||
    String(checkoutSession.metadata.type || '') !== 'care_program'
  ) {
    return { handled: false };
  }

  const result = activateCareProgramSubscription(dbModule, {
    sessionId: checkoutSession.metadata.patient_session_id,
    patientId: checkoutSession.metadata.patient_id || null,
    concernId: checkoutSession.metadata.concern_id || null,
    stripeCustomerId: checkoutSession.customer,
    stripeSubscriptionId: checkoutSession.subscription,
  });

  return { handled: true, ...result };
}

describe('stripe webhook care_program checkout.session.completed', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureBillingTables(db);
  });

  afterEach(() => {
    db.close();
  });

  test('activates care_program tier for matching checkout session', () => {
    const result = handleCareProgramCheckoutCompleted(
      { db },
      {
        id: 'cs_test_1',
        mode: 'subscription',
        customer: 'cus_test',
        subscription: 'sub_test',
        metadata: {
          type: 'care_program',
          patient_session_id: 'sess_webhook_1',
          patient_id: 'patient-1',
          concern_id: 'acne',
        },
      },
    );

    expect(result.handled).toBe(true);
    expect(result.success).toBe(true);
    expect(result.tier).toBe('care_program');

    const row = db
      .prepare(`SELECT tier, status FROM patient_billing_subscriptions WHERE session_id = ?`)
      .get('sess_webhook_1');
    expect(row.tier).toBe('care_program');
    expect(row.status).toBe('active');
  });

  test('ignores non-care_program checkout sessions', () => {
    const result = handleCareProgramCheckoutCompleted(
      { db },
      {
        id: 'cs_test_2',
        mode: 'subscription',
        metadata: { type: 'plus' },
      },
    );

    expect(result.handled).toBe(false);
    const count = db.prepare(`SELECT COUNT(*) AS c FROM patient_billing_subscriptions`).get().c;
    expect(count).toBe(0);
  });
});
