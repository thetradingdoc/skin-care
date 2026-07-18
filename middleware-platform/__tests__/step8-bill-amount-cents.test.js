'use strict';

/**
 * STEP 8 — Bill template amount_cents (money_cents) + $84.00 round-trip on template path.
 */

jest.mock('../services/blob-storage', () => ({
  isAzureConfigured: () => false,
  uploadBuffer: jest.fn(),
  downloadBuffer: jest.fn(),
  generateSignedUrl: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const express = require('express');
const Database = require('better-sqlite3');

const { registerPatientRecordRoutes } = require('../routes/patient-records');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const { getTemplate, applyTemplate, structureWithTemplate } = require('../services/record-field-templates');
const { structureByTag } = require('../services/capture-orchestration/structure-by-tag');
const { validateBillStructured } = require('../services/patient-record-fact-validators');

function formatBillMoneyFromCents(amountCents, currency = 'USD', locale = 'en-US') {
  const n = Number(amountCents);
  if (!Number.isFinite(n)) return '';
  const major = n / 100;
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
      req.patientSessionId = 'sess_bill84';
      req.patientSession = { patient_id: 'Patient/bill84' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/bill84' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/bill84',
      sessionId: 'sess_bill84',
    }),
  });
  return app;
}

describe('STEP 8 — bill template amount_cents', () => {
  test('catalog field is amount_cents with money_cents type (not major amount)', () => {
    const t = getTemplate('bill.default');
    expect(t).toBeTruthy();
    const amount = t.fields.find((f) => f.key === 'amount_cents' || f.key === 'amount');
    expect(amount).toBeTruthy();
    expect(amount.key).toBe('amount_cents');
    expect(amount.type).toBe('money_cents');
    expect(t.fields.some((f) => f.key === 'amount' && f.key !== 'amount_cents')).toBe(false);
  });

  test('applyTemplate: 8400 cents stays 8400; legacy amount 84 → 8400', () => {
    const t = getTemplate('bill.default');
    const fromCents = applyTemplate(t, {
      date: '2026-07-01',
      provider: 'Allerton Eye Care',
      amount_cents: 8400,
      currency: 'USD',
      doc_type: 'receipt',
    });
    expect(fromCents.valid).toBe(true);
    expect(fromCents.normalized.amount_cents).toBe(8400);
    expect(fromCents.normalized.template_id).toBe('bill.default');

    const fromMajor = applyTemplate(t, {
      date: '2026-07-01',
      amount: 84,
      currency: 'USD',
    });
    expect(fromMajor.normalized.amount_cents).toBe(8400);

    // Defensive: dollar string through money_cents coerce
    const fromDollarString = applyTemplate(t, {
      date: '2026-07-01',
      amount_cents: '84.00',
    });
    expect(fromDollarString.normalized.amount_cents).toBe(8400);
  });

  test('OCR / AI path: structureByTag bill $84.00 → template amount_cents 8400', () => {
    const s = structureByTag('bill', {
      ocrText: 'Allerton Eye Care\nService date: 2026-07-01\nAmount due: $84.00',
    });
    expect(s.valid).toBe(true);
    expect(s.template_id || s.normalized.template_id).toBe('bill.default');
    expect(s.normalized.amount_cents).toBe(8400);
    expect(s.normalized.amount).toBeUndefined();
    expect(formatBillMoneyFromCents(s.normalized.amount_cents)).toBe('$84.00');
    expect(formatBillMoneyFromCents(s.normalized.amount_cents)).not.toBe('$0.84');
    expect(formatBillMoneyFromCents(s.normalized.amount_cents)).not.toMatch(/8,400|8400/);

    const viaTemplate = structureWithTemplate({
      tag: 'bill',
      ocrText: 'Clinic\nTotal: $84.00\n2026-07-01',
      preferTemplateId: 'bill.default',
    });
    expect(viaTemplate.normalized.amount_cents).toBe(8400);
  });

  test('template-driven manual entry → confirm → display $84.00 (not $0.84 / $8400)', async () => {
    const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-bill-tpl-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    require('../migrations/069_pending_captures').up(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    require('../migrations/071_capture_sessions').up(db);
    const app = buildApp(db);

    // Simulate TemplateFieldsForm: user typed $84.00 → draft stores cents
    const structured = applyTemplate(getTemplate('bill.default'), {
      date: '2026-07-01',
      provider: 'Allerton Eye Care',
      amount_cents: 8400,
      currency: 'USD',
      doc_type: 'receipt',
    }).normalized;

    const created = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'bill')
      .field('ai_or_manual', 'manual')
      .field('request_id', 'req_bill_tpl_84')
      .field('structured_json', JSON.stringify(structured));

    expect(created.status).toBe(201);
    expect(created.body.fact.structured_json.amount_cents).toBe(8400);
    expect(created.body.fact.structured_json.template_id).toBe('bill.default');
    expect(created.body.fact.structured_json.amount).toBeUndefined();

    const factId = created.body.fact.id;
    const confirmed = await request(app)
      .post(`/api/patient/records/${factId}/confirm`)
      .send({ structured_json: structured });
    expect([200, 201]).toContain(confirmed.status);
    expect(confirmed.body.fact.structured_json.amount_cents).toBe(8400);

    const display = formatBillMoneyFromCents(
      confirmed.body.fact.structured_json.amount_cents,
      'USD',
    );
    expect(display).toBe('$84.00');
    expect(display).not.toBe('$0.84');
    expect(display).not.toMatch(/8,400|8400/);

    // Validator floor agrees
    expect(validateBillStructured(structured).normalized.amount_cents).toBe(8400);

    db.close();
    if (prevRoot === undefined) delete process.env.PATIENT_LOCAL_MEDIA_ROOT;
    else process.env.PATIENT_LOCAL_MEDIA_ROOT = prevRoot;
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (_) {}
  });

  test('confirm bill + manual entry UI use TemplateFieldsForm / bill.default', () => {
    const billConfirm = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/capture/confirm/bill.tsx'),
      'utf8',
    );
    expect(billConfirm).toMatch(/TemplateFieldsForm/);
    expect(billConfirm).toMatch(/getTemplateForDraft/);
    expect(billConfirm).not.toMatch(/centsToDollarsDisplay/);

    const manual = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/capture/manual-entry.tsx'),
      'utf8',
    );
    expect(manual).toMatch(/bill\.default|tag === 'bill'/);
    expect(manual).toMatch(/TemplateFieldsForm/);

    const form = fs.readFileSync(
      path.join(__dirname, '../../patient-app/components/capture/TemplateFieldsForm.tsx'),
      'utf8',
    );
    expect(form).toMatch(/money_cents/);
    expect(form).toMatch(/\/ 100|Math\.round\(major \* 100\)/);
  });
});
