'use strict';

jest.mock('../services/gcs-billing-storage', () => ({
  uploadBuffer: jest.fn(async () => ({ storageRef: 'gs://test/journal-photo.jpg' })),
}));

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientJournalRoutes } = require('../routes/patient-journal');
const { ensureJournalTables } = require('../lib/patient-journal-db');
const { todayIsoUtc, parseIsoDateOnly } = require('../lib/routine-day-mode');

function offsetIsoDate(baseIso, days) {
  const d = parseIsoDateOnly(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clientDateHeader(iso) {
  return { 'x-client-date': iso };
}

function buildApp(db) {
  const app = express();
  registerPatientJournalRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_journal_test';
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    recordPatientPortalEvent: jest.fn(),
    parseBillingDocumentUpload: (req, _res, next) => {
      req.file = {
        buffer: Buffer.from('fake-image'),
        mimetype: 'image/jpeg',
        originalname: 'face.jpg',
      };
      next();
    },
    ensureJournalTables,
    isIsoDateOnly: (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()),
  });
  return app;
}

describe('patient journal routes', () => {
  let db;
  let app;
  let today;
  let yesterday;
  const prevStandalone = process.env.JOURNAL_MODE_STANDALONE;
  const prevTriggers = process.env.TRIGGER_INSIGHTS_ENABLED;
  const prevImprovements = process.env.IMPROVEMENTS_API_ENABLED;

  beforeEach(() => {
    process.env.JOURNAL_MODE_STANDALONE = '1';
    process.env.TRIGGER_INSIGHTS_ENABLED = '1';
    process.env.IMPROVEMENTS_API_ENABLED = '1';
    today = todayIsoUtc();
    yesterday = offsetIsoDate(today, -1);
    db = new Database(':memory:');
    ensureJournalTables(db);
    app = buildApp(db);
  });

  afterEach(() => {
    process.env.JOURNAL_MODE_STANDALONE = prevStandalone;
    process.env.TRIGGER_INSIGHTS_ENABLED = prevTriggers;
    process.env.IMPROVEMENTS_API_ENABLED = prevImprovements;
    db.close();
  });

  test('POST daily-photo creates journal entry', async () => {
    const res = await request(app)
      .post('/api/patient/journal/daily-photo')
      .set(clientDateHeader(today))
      .field('entry_date', yesterday);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.has_photo).toBe(true);

    const checkin = await request(app)
      .patch('/api/patient/journal/daily-entry')
      .set(clientDateHeader(today))
      .send({ entry_date: yesterday, condition_tags: ['calm'], note: 'Skipped makeup' });
    expect(checkin.body.condition_tags).toEqual(['calm']);
    expect(checkin.body.note).toBe('Skipped makeup');
  });

  test('PATCH daily-entry saves check-in without photo', async () => {
    const res = await request(app)
      .patch('/api/patient/journal/daily-entry')
      .set(clientDateHeader(today))
      .send({ entry_date: today, condition_tags: ['breaking_out'], note: 'Tried new makeup' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.has_photo).toBe(false);
    expect(res.body.condition_tags).toEqual(['breaking_out']);
  });

  test('GET timeline returns recent entries', async () => {
    await request(app)
      .patch('/api/patient/journal/daily-entry')
      .set(clientDateHeader(today))
      .send({ entry_date: yesterday, condition_tags: ['calm'] });
    await request(app)
      .patch('/api/patient/journal/daily-entry')
      .set(clientDateHeader(today))
      .send({ entry_date: today, condition_tags: ['dry'] });

    const res = await request(app)
      .get('/api/patient/journal/timeline?days=8')
      .set(clientDateHeader(today));
    expect(res.status).toBe(200);
    expect(res.body.days.length).toBeGreaterThanOrEqual(1);
  });

  test('POST daily-photo returns 503 when feature disabled', async () => {
    process.env.JOURNAL_MODE_STANDALONE = '0';
    const res = await request(app).post('/api/patient/journal/daily-photo');
    expect(res.status).toBe(503);
    expect(res.body.error_code).toBe('JOURNAL_MODE_DISABLED');
  });
});
