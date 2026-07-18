'use strict';

/**
 * Data-integrity adversarial tests:
 * A) Client-shaped capture retry with same request_id → exactly one DB fact
 * B) $84.00 bill through capture → confirm → amount_cents + display ($84.00 not ¢84 / $8400)
 */

jest.mock('../services/blob-storage', () => ({
  isAzureConfigured: () => false,
  uploadBuffer: jest.fn(),
  downloadBuffer: jest.fn(),
  generateSignedUrl: jest.fn(),
}));

const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientRecordRoutes } = require('../routes/patient-records');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const { migrateBillFactStructured } = require('../migrations/073_bill_amount_cents_canonical');
const { validateBillStructured } = require('../services/patient-record-fact-validators');

/** Mirror of patient-app formatBillMoney for USD (minor → major). */
function formatBillMoneyFromCents(amountCents, currency = 'USD', locale = 'en-US') {
  const major = Number(amountCents) / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(major);
}

function buildApp(db) {
  const app = express();
  registerPatientRecordRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_integrity';
      req.patientSession = { patient_id: 'Patient/integrity1' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/integrity1' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/integrity1',
      sessionId: 'sess_integrity',
    }),
  });
  return app;
}

describe('PART A — client request_id retry does not duplicate facts', () => {
  let db;
  let app;
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-integrity-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    require('../migrations/069_pending_captures').up(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    require('../migrations/071_capture_sessions').up(db);
    app = buildApp(db);
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prevRoot;
    try {
      db.close();
    } catch (_) {}
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (_) {}
  });

  test('same request_id fired twice (manual-entry / track-capture shape) → one fact', async () => {
    // Mirrors patient-app captureRecordFact FormData: tag, ai_or_manual, structured_json, request_id
    const requestId = 'req_client_retry_stable_abc';
    const payload = {
      tag: 'other',
      ai_or_manual: 'manual',
      request_id: requestId,
      structured_json: JSON.stringify({
        date: '2026-07-16',
        label: 'flaky retry',
        free_text_facts: 'network blip',
      }),
    };

    const first = await request(app).post('/api/patient/records/capture').field(payload);
    expect(first.status).toBe(201);
    expect(first.body.success).toBe(true);
    expect(first.body.idempotent_replay).toBeFalsy();
    const factId = first.body.fact?.id;
    expect(factId).toBeTruthy();

    const second = await request(app).post('/api/patient/records/capture').field(payload);
    expect(second.status).toBe(201);
    expect(second.body.success).toBe(true);
    expect(second.body.idempotent_replay).toBe(true);
    expect(second.body.fact?.id).toBe(factId);

    const rows = db
      .prepare(`SELECT id, request_id FROM patient_record_facts WHERE request_id = ?`)
      .all(requestId);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(factId);

    const allForOwner = db
      .prepare(`SELECT COUNT(*) AS n FROM patient_record_facts WHERE session_id = ?`)
      .get('sess_integrity');
    expect(allForOwner.n).toBe(1);
  });
});

describe('PART B — amount_cents canonical $84.00 round-trip', () => {
  let db;
  let app;
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-bill-cents-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    require('../migrations/069_pending_captures').up(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    require('../migrations/071_capture_sessions').up(db);
    app = buildApp(db);
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prevRoot;
    try {
      db.close();
    } catch (_) {}
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (_) {}
  });

  test('write $84.00 → confirm API + formatBillMoney both show $84.00', async () => {
    const created = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'bill')
      .field('ai_or_manual', 'manual')
      .field('request_id', 'req_bill_84')
      .field(
        'structured_json',
        JSON.stringify({
          date: '2026-07-01',
          provider: 'Allerton Eye Care',
          amount_cents: 8400,
          currency: 'USD',
          doc_type: 'receipt',
        }),
      );

    expect(created.status).toBe(201);
    const factId = created.body.fact?.id;
    expect(factId).toBeTruthy();
    expect(created.body.fact.structured_json.amount_cents).toBe(8400);
    expect(created.body.fact.structured_json.amount).toBeUndefined();

    const confirmed = await request(app)
      .post(`/api/patient/records/${factId}/confirm`)
      .send({
        structured_json: {
          date: '2026-07-01',
          provider: 'Allerton Eye Care',
          amount_cents: 8400,
          currency: 'USD',
          doc_type: 'receipt',
        },
      });
    expect([200, 201]).toContain(confirmed.status);
    expect(confirmed.body.fact.structured_json.amount_cents).toBe(8400);
    expect(confirmed.body.fact.structured_json.amount).toBeUndefined();

    const display = formatBillMoneyFromCents(confirmed.body.fact.structured_json.amount_cents, 'USD');
    expect(display).toBe('$84.00');
    expect(display).not.toBe('$0.84');
    expect(display).not.toMatch(/8,400|8400/);

    // Legacy major-unit write boundary still converts correctly
    const fromMajor = validateBillStructured({ date: '2026-07-01', amount: 84, currency: 'USD' });
    expect(fromMajor.normalized.amount_cents).toBe(8400);
    expect(formatBillMoneyFromCents(fromMajor.normalized.amount_cents)).toBe('$84.00');
  });

  test('migration: major-unit amount → amount_cents; ambiguous conflation flagged', () => {
    expect(migrateBillFactStructured({ date: '2026-07-01', amount: 84, currency: 'USD' })).toEqual({
      status: 'migrated',
      structured: { date: '2026-07-01', amount_cents: 8400, currency: 'USD' },
    });
    expect(
      migrateBillFactStructured({ date: '2026-07-01', amount: 8400, amount_cents: 8400, currency: 'USD' })
        .status,
    ).toBe('needs_review');
    expect(
      migrateBillFactStructured({ date: '2026-07-01', amount_cents: 8400, currency: 'USD' }).status,
    ).toBe('skip');
  });
});
