'use strict';

/**
 * LEG-03 — Soft-deprecation headers on patient-spots write routes.
 */

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientSpotsRoutes } = require('../routes/patient-spots');

function buildApp(db) {
  const app = express();
  const noopMw = (_req, _res, next) => next();
  registerPatientSpotsRoutes(app, {
    apiLimiter: noopMw,
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_leg03';
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'p_leg03' }),
    parseBillingDocumentUpload: noopMw,
    recordPatientPortalEvent: jest.fn(),
  });
  return app;
}

describe('LEG-03 patient-spots Deprecation headers', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE patient_spots (
        id TEXT PRIMARY KEY,
        owner_key TEXT NOT NULL,
        label TEXT NOT NULL,
        body_region TEXT NOT NULL,
        created_at TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE TABLE patient_spot_snapshots (
        id TEXT PRIMARY KEY,
        spot_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        storage_ref TEXT,
        thumb_storage_ref TEXT,
        journal_entry_id TEXT,
        analysis_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    app = buildApp(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('POST /api/patient/spots returns Deprecation + Sunset headers', async () => {
    const res = await request(app)
      .post('/api/patient/spots')
      .send({ label: 'cheek', body_region: 'face' });

    expect(res.status).toBe(200);
    expect(res.headers.deprecation).toBe('true');
    expect(res.headers.sunset).toBe('Sat, 01 Aug 2026 00:00:00 GMT');
    expect(res.body.success).toBe(true);
  });
});
