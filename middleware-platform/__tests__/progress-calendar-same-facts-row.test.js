'use strict';

/**
 * Adversarial: one capture → confirm → same fact row drives both
 * GET /api/patient/records/calendar and GET /api/patient/progress/aggregates.
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
const { registerPatientMedicalProgressRoutes } = require('../routes/patient-medical-progress');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

function buildApp(db) {
  const app = express();
  const deps = {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_prog_cal';
      req.patientSession = { patient_id: 'Patient/prog_cal' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/prog_cal' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/prog_cal',
      sessionId: 'sess_prog_cal',
    }),
  };
  registerPatientMedicalProgressRoutes(app, deps);
  registerPatientRecordRoutes(app, deps);
  return app;
}

describe('Progress + Calendar share one facts row', () => {
  let db;
  let app;
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-prog-cal-'));
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

  test('capture+confirm skin fact appears in calendar list and progress aggregates', async () => {
    const entryDate = '2026-07-16';
    const created = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'skin')
      .field('ai_or_manual', 'manual')
      .field('request_id', 'req_prog_cal_skin_1')
      .field(
        'structured_json',
        JSON.stringify({ date: entryDate, note: 'shared history', body_area: 'cheek' }),
      );
    expect(created.status).toBe(201);
    const factId = created.body.fact?.id;
    expect(factId).toBeTruthy();

    const confirmed = await request(app)
      .post(`/api/patient/records/${factId}/confirm`)
      .send({
        structured_json: { date: entryDate, note: 'shared history', body_area: 'cheek' },
      });
    expect([200, 201]).toContain(confirmed.status);
    expect(confirmed.body.fact?.confirmed_at || confirmed.body.fact?.id).toBeTruthy();

    const cal = await request(app).get(
      `/api/patient/records/calendar?start=${entryDate}&end=${entryDate}`,
    );
    expect(cal.status).toBe(200);
    expect(cal.body.source).toBe('patient_record_facts');
    expect(cal.body.days).toHaveLength(1);
    expect(cal.body.days[0].date).toBe(entryDate);
    expect(cal.body.days[0].tags).toContain('skin');
    const calFactIds = (cal.body.days[0].facts || []).map((f) => f.id);
    expect(calFactIds).toContain(factId);

    const agg = await request(app).get('/api/patient/progress/aggregates');
    expect(agg.status).toBe(200);
    expect(agg.body.source).toBe('patient_record_facts');
    expect(agg.body.skin).toBeTruthy();
    expect(agg.body.skin.fact_count).toBe(1);

    // Same underlying row — not two separately-seeded stores
    const dbRow = db.prepare(`SELECT id, tag FROM patient_record_facts WHERE id = ?`).get(factId);
    expect(dbRow.tag).toBe('skin');
    expect(calFactIds).toEqual([factId]);
    expect(agg.body.skin.fact_count).toBe(calFactIds.length);
  });
});
