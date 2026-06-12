'use strict';

jest.mock('../services/consumer-journey-agent', () => ({
  getNextActions: jest.fn(async () => ({ actions: [{ type: 'track_spot', title: 'Track', route: '/track', priority: 1 }] })),
}));

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientGoalsRoutes } = require('../routes/patient-goals');

function buildApp(db) {
  const app = express();
  registerPatientGoalsRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_route_goals';
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    loadPatientShelfProductRows: () => [],
  });
  return app;
}

describe('patient goals routes', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    require('../migrations/057_patient_goals').up(db);
    app = buildApp(db);
    process.env.NEXT_GEN_PIPELINE = '0';
  });

  afterEach(() => {
    db.close();
  });

  test('GET /api/patient/goals returns list', async () => {
    const res = await request(app).get('/api/patient/goals');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.goals)).toBe(true);
  });

  test('POST /api/patient/goals creates goal', async () => {
    const res = await request(app)
      .post('/api/patient/goals')
      .send({ goal_type: 'improve_routine' });
    expect(res.status).toBe(200);
    expect(res.body.goal.goal_type).toBe('improve_routine');
  });

  test('GET /api/patient/home/next-actions returns actions', async () => {
    const res = await request(app).get('/api/patient/home/next-actions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.actions)).toBe(true);
  });
});
