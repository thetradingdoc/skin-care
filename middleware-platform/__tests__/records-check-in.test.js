'use strict';

/**
 * Daily check-in → patient_record_facts (confirmed skin, unmetered).
 */

jest.mock('../services/blob-storage', () => ({
  isAzureConfigured: () => false,
  uploadBuffer: jest.fn(),
  downloadBuffer: jest.fn(),
  generateSignedUrl: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientRecordRoutes } = require('../routes/patient-records');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const { buildFactsCalendar } = require('../services/medical-tracker-domain/facts-calendar');

function buildApp(db) {
  const app = express();
  registerPatientRecordRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_checkin';
      req.patientSession = { patient_id: 'Patient/checkin1' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/checkin1' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/checkin1',
      sessionId: 'sess_checkin',
    }),
  });
  return app;
}

describe('POST /api/patient/records/check-in', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    app = buildApp(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('creates confirmed skin fact and appears in list + calendar', async () => {
    const res = await request(app)
      .post('/api/patient/records/check-in')
      .set('x-client-date', '2026-07-21')
      .send({ feeling: 'calmer', source: 'daily_checkin' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.feeling).toBe('calmer');
    expect(res.body.entry_date).toBe('2026-07-21');
    expect(res.body.fact).toMatchObject({
      tag: 'skin',
      ai_or_manual: 'manual',
      patient_id: 'Patient/checkin1',
    });
    expect(res.body.fact.confirmed_at).toBeTruthy();
    expect(res.body.fact.structured_json?.note).toBe('Calmer');
    expect(res.body.fact.structured_json?.feeling).toBe('calmer');
    expect(res.body.fact.structured_json?.source).toBe('daily_checkin');
    expect(res.body.fact.structured_json?.date).toBe('2026-07-21');

    const row = db
      .prepare(
        `SELECT id, patient_id, tag, ai_or_manual, entry_date, confirmed_at
         FROM patient_record_facts WHERE patient_id = ?`,
      )
      .get('Patient/checkin1');
    expect(row).toBeTruthy();
    expect(row.tag).toBe('skin');
    expect(row.ai_or_manual).toBe('manual');
    expect(row.entry_date).toBe('2026-07-21');
    expect(row.confirmed_at).toBeTruthy();

    const list = await request(app).get(
      '/api/patient/records?tag=skin&start=2026-07-21&end=2026-07-21',
    );
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);
    expect(list.body.facts).toHaveLength(1);
    expect(list.body.facts[0].id).toBe(row.id);
    expect(list.body.facts[0].structured_json?.feeling).toBe('calmer');

    const cal = buildFactsCalendar(db, {
      patientId: 'Patient/checkin1',
      sessionId: 'sess_checkin',
      start: '2026-07-21',
      end: '2026-07-21',
    });
    expect(cal.success).toBe(true);
    const day = (cal.days || []).find((d) => d.date === '2026-07-21');
    expect(day).toBeTruthy();
    expect(day.tags).toContain('skin');
    expect(day.facts.some((f) => f.id === row.id)).toBe(true);
  });

  test('rejects invalid feeling', async () => {
    const res = await request(app)
      .post('/api/patient/records/check-in')
      .send({ feeling: 'amazing' });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('INVALID_FEELING');
  });

  test('upserts same day check-in (idempotent request_id)', async () => {
    const first = await request(app)
      .post('/api/patient/records/check-in')
      .set('x-client-date', '2026-07-21')
      .send({ feeling: 'worse' });
    const second = await request(app)
      .post('/api/patient/records/check-in')
      .set('x-client-date', '2026-07-21')
      .send({ feeling: 'calmer' });
    expect(first.body.fact.id).toBe(second.body.fact.id);
    expect(second.body.fact.structured_json.feeling).toBe('calmer');
    const count = db.prepare(`SELECT COUNT(*) AS n FROM patient_record_facts`).get().n;
    expect(count).toBe(1);
  });
});
