'use strict';

const Database = require('better-sqlite3');
const { ensureBillingTables } = require('../database/billing-tables');
const { activateCareProgramSubscription } = require('../services/care-program-billing-service');

describe('care-program-billing-service', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureBillingTables(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('activateCareProgramSubscription inserts care_program row', () => {
    const result = activateCareProgramSubscription(
      { db },
      {
        sessionId: 'sess-1',
        patientId: 'patient-1',
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test',
        concernId: 'acne',
      }
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe('care_program');

    const row = db
      .prepare(`SELECT tier, status, patient_id, metadata_json FROM patient_billing_subscriptions WHERE session_id = ?`)
      .get('sess-1');

    expect(row.tier).toBe('care_program');
    expect(row.status).toBe('active');
    expect(row.patient_id).toBe('patient-1');
    const meta = JSON.parse(row.metadata_json);
    expect(meta.stripe_subscription_id).toBe('sub_test');
    expect(meta.concern_id).toBe('acne');
  });

  test('activateCareProgramSubscription updates existing row', () => {
    db.prepare(
      `
      INSERT INTO patient_billing_subscriptions (id, session_id, patient_id, tier, status, created_at, updated_at)
      VALUES ('sub-row-1', 'sess-2', NULL, 'free', 'active', datetime('now'), datetime('now'))
    `
    ).run();

    const result = activateCareProgramSubscription(
      { db },
      {
        sessionId: 'sess-2',
        patientId: 'patient-2',
        stripeSubscriptionId: 'sub_updated',
      }
    );

    expect(result.success).toBe(true);
    const rows = db.prepare(`SELECT tier, patient_id FROM patient_billing_subscriptions WHERE session_id = ?`).all('sess-2');
    expect(rows).toHaveLength(1);
    expect(rows[0].tier).toBe('care_program');
    expect(rows[0].patient_id).toBe('patient-2');
  });
});
