'use strict';

/**
 * Phase A — Progress Kelly API route: auth, ownership, in-flight lock.
 */

jest.mock('../services/progress-kelly-judge', () => ({
  checkGuardrailJudge: jest.fn(async () => ({ passed: true })),
}));

jest.mock('../services/consumer-rails/node-runner', () => {
  const actual = jest.requireActual('../services/consumer-rails/node-runner');
  return {
    ...actual,
    runConsumerLlmStep: jest.fn(),
  };
});

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientMedicalProgressRoutes } = require('../routes/patient-medical-progress');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { runConsumerLlmStep } = require('../services/consumer-rails/node-runner');
const {
  _resetProgressKellyInflightForTests,
} = require('../services/progress-kelly-inflight');

const SESSION_PATIENT = 'Patient/kelly_route_a';
const OTHER_PATIENT = 'Patient/kelly_route_other';

function buildApp(db, { patientId = SESSION_PATIENT } = {}) {
  const app = express();
  const deps = {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_kelly_route';
      req.patientSession = { patient_id: patientId };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId }),
  };
  registerPatientMedicalProgressRoutes(app, deps);
  return app;
}

function seedMark(db, { patientId, markId, note = 'spot' }) {
  factsRepo.ensurePatientRecordFactsTable(db);
  return factsRepo.insertFact(db, {
    patient_id: patientId,
    session_id: 'sess_kelly_route',
    owner_key: `patient:${patientId}`,
    tag: 'mark',
    ai_or_manual: 'manual',
    structured_json: { date: '2026-07-01', body_location: 'cheek', note },
    compare_group_id: markId,
    confirmed_at: '2026-07-01T12:00:00.000Z',
  });
}

describe('POST /api/patient/progress/kelly (Phase A)', () => {
  let db;
  let app;

  beforeEach(() => {
    process.env.FEATURE_PROGRESS_KELLY = '1';
    _resetProgressKellyInflightForTests();
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS patient_routine_templates (
        id TEXT PRIMARY KEY, session_id TEXT, patient_id TEXT, name TEXT NOT NULL,
        start_date TEXT, is_active INTEGER DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS patient_routine_daily_entries (
        id TEXT PRIMARY KEY, template_id TEXT, session_id TEXT, patient_id TEXT, entry_date TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_routine_daily_item_logs (
        id TEXT PRIMARY KEY, daily_entry_id TEXT, completed INTEGER DEFAULT 0
      );
    `);
    seedMark(db, { patientId: SESSION_PATIENT, markId: 'cg_own' });
    seedMark(db, { patientId: OTHER_PATIENT, markId: 'cg_other' });
    app = buildApp(db);
    runConsumerLlmStep.mockReset();
    runConsumerLlmStep.mockResolvedValue({
      success: true,
      content: JSON.stringify({
        message_type: 'observation',
        body: 'You have 1 confirmed photo for this mark.',
        day_reference: null,
        action: { label: 'Compare', type: 'compare' },
      }),
      tools_used: [],
    });
  });

  afterEach(() => {
    db.close();
    delete process.env.FEATURE_PROGRESS_KELLY;
    _resetProgressKellyInflightForTests();
  });

  test('rejects patient_id in body (session-derived only)', async () => {
    const res = await request(app)
      .post('/api/patient/progress/kelly')
      .send({ mark_id: 'cg_own', patient_id: OTHER_PATIENT });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('PATIENT_ID_NOT_ALLOWED');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();
  });

  test('rejects patientId camelCase in body', async () => {
    const res = await request(app)
      .post('/api/patient/progress/kelly')
      .send({ mark_id: 'cg_own', patientId: OTHER_PATIENT });
    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('PATIENT_ID_NOT_ALLOWED');
  });

  test('rejects mark_id belonging to another patient', async () => {
    const res = await request(app)
      .post('/api/patient/progress/kelly')
      .send({ mark_id: 'cg_other' });
    expect(res.status).toBe(404);
    expect(res.body.error_code).toBe('MARK_NOT_FOUND');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();
  });

  test('success passes through service shape including client_action', async () => {
    const res = await request(app)
      .post('/api/patient/progress/kelly')
      .send({ mark_id: 'cg_own' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.client_action).toBe('render');
    expect(res.body.message?.body).toBeTruthy();
    expect(runConsumerLlmStep).toHaveBeenCalledTimes(1);
  });

  test('two concurrent requests share one generation (no double LLM)', async () => {
    let calls = 0;
    runConsumerLlmStep.mockImplementation(async () => {
      calls += 1;
      // Hold long enough for the sibling request to join the in-flight promise
      await new Promise((r) => setTimeout(r, 150));
      return {
        success: true,
        content: JSON.stringify({
          message_type: 'observation',
          body: 'Shared concurrent generation.',
          day_reference: null,
          action: { label: 'None', type: 'none' },
        }),
        tools_used: [],
      };
    });

    // Start both at once (supertest only fires when the thenable is observed)
    const [r1, r2] = await Promise.all([
      request(app).post('/api/patient/progress/kelly').send({ mark_id: 'cg_own' }),
      request(app).post('/api/patient/progress/kelly').send({ mark_id: 'cg_own' }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.message?.body).toBe('Shared concurrent generation.');
    expect(r2.body.message?.body).toBe(r1.body.message?.body);
    expect(r2.body.prior_failure?.reason).not.toBe('rate_limited');
    expect(calls).toBe(1);
  });

  test('feature flag off still returns fallback via service (route does not bypass)', async () => {
    delete process.env.FEATURE_PROGRESS_KELLY;
    const res = await request(app)
      .post('/api/patient/progress/kelly')
      .send({ mark_id: 'cg_own' });
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.client_action).toBe('render_fallback');
    expect(res.body.prior_failure?.reason).toBe('feature_disabled');
    expect(runConsumerLlmStep).not.toHaveBeenCalled();
  });
});
