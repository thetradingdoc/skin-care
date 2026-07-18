'use strict';

/**
 * Adversarial: mark capture → confirm → same fact row on
 * GET /marks, /records/calendar, /progress/aggregates (Track + Calendar + Progress).
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
      req.patientSessionId = 'sess_track_marks';
      req.patientSession = { patient_id: 'Patient/track_marks' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/track_marks' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/track_marks',
      sessionId: 'sess_track_marks',
    }),
  };
  registerPatientMedicalProgressRoutes(app, deps);
  registerPatientRecordRoutes(app, deps);
  return app;
}

describe('Track marks + Calendar + Progress share one fact row', () => {
  let db;
  let app;
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-track-marks-'));
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

  test('confirmed mark fact appears on marks list, calendar, and progress aggregates', async () => {
    const entryDate = '2026-07-16';
    const compareGroupId = 'cg_track_adversarial_1';
    const created = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'mark')
      .field('ai_or_manual', 'manual')
      .field('request_id', 'req_track_mark_1')
      .field(
        'structured_json',
        JSON.stringify({
          date: entryDate,
          body_location: 'forearm',
          label: 'mole',
          compare_group_id: compareGroupId,
        }),
      );
    expect(created.status).toBe(201);
    const factId = created.body.fact?.id;
    expect(factId).toBeTruthy();

    const confirmed = await request(app)
      .post(`/api/patient/records/${factId}/confirm`)
      .send({
        structured_json: {
          date: entryDate,
          body_location: 'forearm',
          label: 'mole',
          compare_group_id: compareGroupId,
        },
      });
    expect([200, 201]).toContain(confirmed.status);

    const marks = await request(app).get('/api/patient/marks');
    expect(marks.status).toBe(200);
    expect(marks.body.marks.some((m) => m.id === factId)).toBe(true);
    const markRow = marks.body.marks.find((m) => m.id === factId);
    expect(markRow.compare_group_id).toBe(compareGroupId);

    const cal = await request(app).get(
      `/api/patient/records/calendar?start=${entryDate}&end=${entryDate}`,
    );
    expect(cal.status).toBe(200);
    expect(cal.body.source).toBe('patient_record_facts');
    expect(cal.body.days[0].tags).toContain('mark');
    expect(cal.body.days[0].facts.map((f) => f.id)).toContain(factId);

    const agg = await request(app).get('/api/patient/progress/aggregates');
    expect(agg.status).toBe(200);
    expect(agg.body.mark.fact_count).toBe(1);
    expect(agg.body.mark.compare_group_count).toBe(1);

    const timeline = await request(app).get(
      `/api/patient/marks/compare-group/${encodeURIComponent(compareGroupId)}`,
    );
    expect(timeline.status).toBe(200);
    const timelineIds = (timeline.body.facts || timeline.body.entries || []).map((f) => f.id);
    expect(timelineIds).toContain(factId);
  });
});
