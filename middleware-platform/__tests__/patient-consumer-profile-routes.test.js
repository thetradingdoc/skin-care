'use strict';

jest.mock('../repositories/patient-goals-repo', () => ({
  seedDefaultGoals: jest.fn(async () => [{ id: 'g1', goal_type: 'watch_spot' }]),
}));

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientConsumerProfileRoutes } = require('../routes/patient-consumer-profile');
const { ensureSqliteConsumerTables } = require('../db/client');
const { seedDefaultGoals } = require('../repositories/patient-goals-repo');

function buildApp(db) {
  const app = express();
  registerPatientConsumerProfileRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_profile_route';
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    recordPatientPortalEvent: jest.fn(),
  });
  return app;
}

describe('patient consumer-profile routes', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    ensureSqliteConsumerTables(db);
    require('../migrations/057_patient_goals').up(db);
    app = buildApp(db);
    jest.mocked(seedDefaultGoals).mockReset();
    jest.mocked(seedDefaultGoals).mockResolvedValue([{ id: 'g1', goal_type: 'watch_spot' }]);
  });

  afterEach(() => {
    db.close();
  });

  test('PATCH journey_modes returns goals_seeded true when seed succeeds', async () => {
    const res = await request(app)
      .patch('/api/patient/consumer-profile')
      .send({ journey_modes: ['watch', 'routine'], primary_mode: 'watch' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.goals_seeded).toBe(true);
    expect(seedDefaultGoals).toHaveBeenCalled();
  });

  test('PATCH journey_modes returns goals_seeded false when seed fails', async () => {
    jest.mocked(seedDefaultGoals).mockRejectedValueOnce(new Error('seed_failed'));

    const res = await request(app)
      .patch('/api/patient/consumer-profile')
      .send({ journey_modes: ['watch'], primary_mode: 'watch' });

    expect(res.status).toBe(200);
    expect(res.body.goals_seeded).toBe(false);
    expect(res.body.profile.modes).toEqual(['watch']);
  });
});
