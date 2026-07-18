'use strict';

/**
 * Source-wiring regressions for meter call sites + record middleware (P1.07–09, P2.08–10).
 * These fail if tryConsume / tag middleware are removed from the live routes.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientRecordRoutes } = require('../routes/patient-records');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');

const root = path.join(__dirname, '..');

function readService(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

describe('P1 meter call-site wiring', () => {
  test('P1.07 face-read meter wiring calls tryConsume with face_read_vision', () => {
    const src = readService('routes/public-face-read.js');
    expect(src).toMatch(/tryConsume/);
    expect(src).toMatch(/face_read_vision/);
  });

  test('P1.08 weekly rescore meter wiring uses weekly_photo_rescore', () => {
    const src = readService('routes/patient-routine.js');
    expect(src).toMatch(/weekly_photo_rescore/);
    expect(src).toMatch(/tryConsume/);
  });

  test('P1.09 billing OCR meter wiring uses billing_ocr', () => {
    const src = readService('routes/patient-billing-portal.js');
    expect(src).toMatch(/captureKind:\s*'billing_ocr'/);
    expect(src).toMatch(/tryConsume/);
  });
});

describe('P2.08–P2.10 record upload middleware + HTTP', () => {
  test('P2.08 requireRecordTag rejects unknown tags in middleware source', () => {
    const src = readService('middleware/patient-record-facts.js');
    expect(src).toMatch(/requireRecordTag/);
    expect(src).toMatch(/INVALID_TAG|tag_invalid|RECORD_TAGS/);
  });

  test('P2.09 requireRecordMediaType rejects non photo|pdf', () => {
    const src = readService('middleware/patient-record-facts.js');
    expect(src).toMatch(/requireRecordMediaType/);
    expect(src).toMatch(/photo|pdf/);
  });

  test('P2.10 POST /api/patient/records/upload persists a fact', async () => {
    const db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    const app = express();
    registerPatientRecordRoutes(app, {
      apiLimiter: (_req, _res, next) => next(),
      express,
      db: { db },
      requirePatientSession: (req, _res, next) => {
        req.patientSessionId = 'sess_upload';
        req.patientSession = {};
        next();
      },
      resolvePatientIdFromSession: () => ({ patientId: 'Patient/upload' }),
      recordPatientPortalEvent: jest.fn(),
    });

    const prevAzure = {
      AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
      AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
      AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
    };
    delete process.env.AZURE_STORAGE_ACCOUNT;
    delete process.env.AZURE_STORAGE_KEY;
    delete process.env.AZURE_STORAGE_CONTAINER;

    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(2048, 1),
    ]);
    const res = await request(app)
      .post('/api/patient/records/upload')
      .field('tag', 'skin')
      .field('media_type', 'photo')
      .field('ai_or_manual', 'manual')
      .field('structured_json', JSON.stringify({ date: '2026-07-16', note: 'upload' }))
      .attach('file', jpeg, { filename: 'face.jpg', contentType: 'image/jpeg' });

    for (const [k, v] of Object.entries(prevAzure)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.fact?.tag).toBe('skin');
    expect(res.body.fact?.storage_ref || res.body.fact?.media_url).toBeTruthy();
    db.close();
  });
});
