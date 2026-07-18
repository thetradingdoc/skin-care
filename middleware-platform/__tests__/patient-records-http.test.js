'use strict';

/**
 * M15 / C2 / H5 — HTTP-level patient records + bill OCR path tests.
 * These fail if local write (C1) or capture wiring regressions land.
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
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const {
  claimPendingCaptures,
  getPendingByToken,
  bindCaptureTokenToOtpSession,
} = require('../services/pending-capture-claim');

function buildApp(db) {
  const app = express();
  registerPatientRecordRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_http_records';
      req.patientSession = { patient_id: 'Patient/http1' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/http1' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({ tier: 'free', patientId: 'Patient/http1', sessionId: 'sess_http_records' }),
  });
  return app;
}

describe('HTTP /api/patient/records/*', () => {
  let db;
  let app;
  let tmpRoot;
  const prevRoot = process.env.PATIENT_LOCAL_MEDIA_ROOT;
  const prevAzure = {
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
    AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
    AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
  };

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'touche-http-media-'));
    process.env.PATIENT_LOCAL_MEDIA_ROOT = tmpRoot;
    process.env.PATIENT_RECORD_AV_DEV_BYPASS = '1';
    delete process.env.CLAMAV_SOCKET;
    delete process.env.CLAMAV_BIN;
    delete process.env.AZURE_STORAGE_ACCOUNT;
    delete process.env.AZURE_STORAGE_KEY;
    delete process.env.AZURE_STORAGE_CONTAINER;
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
    for (const [k, v] of Object.entries(prevAzure)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      db.close();
    } catch (_) {}
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (_) {}
  });

  test('P3.15 API POST /api/patient/records/capture returning confirm draft', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    // pad so quality gate accepts
    const buf = Buffer.concat([jpeg, Buffer.alloc(2048, 1)]);
    const res = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'mark')
      .field('ai_or_manual', 'manual')
      .field(
        'structured_json',
        JSON.stringify({ date: '2026-07-16', label: 'cheek', body_location: 'neck' }),
      )
      .attach('file', buf, { filename: 'spot.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.fact?.tag || res.body.draft?.tag).toBeDefined();
    const rows = db.prepare(`SELECT tag, ai_or_manual FROM patient_record_facts`).all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.tag === 'mark')).toBe(true);
  });

  test('P3.16 API POST /api/patient/records/:id/confirm persisting user edits', async () => {
    const created = await request(app)
      .post('/api/patient/records/capture')
      .field('tag', 'other')
      .field('ai_or_manual', 'manual')
      .field(
        'structured_json',
        JSON.stringify({ date: '2026-07-16', label: 'draft note', free_text_facts: 'x' }),
      );
    expect(created.status).toBe(201);
    const factId = created.body.fact?.id || created.body.draft?.id;
    expect(factId).toBeTruthy();

    const confirmed = await request(app)
      .post(`/api/patient/records/${factId}/confirm`)
      .send({
        structured_json: { date: '2026-07-16', label: 'confirmed note', free_text_facts: 'y' },
      });
    expect([200, 201]).toContain(confirmed.status);
    expect(confirmed.body.success !== false).toBe(true);
    const row = db.prepare(`SELECT confirmed_at, structured_json FROM patient_record_facts WHERE id = ?`).get(factId);
    expect(row.confirmed_at).toBeTruthy();
    // At rest: ciphertext (or legacy plaintext). App layer returns decrypted via repo.
    const { isEncryptedFactField } = require('../services/patient-record-field-crypto');
    if (typeof row.structured_json === 'string' && isEncryptedFactField(row.structured_json)) {
      expect(row.structured_json).not.toMatch(/confirmed note/i);
      const hydrated = factsRepo.getFactById(db, factId);
      expect(String(hydrated.structured_json?.label || '')).toMatch(/confirmed/i);
    } else {
      const structured =
        typeof row.structured_json === 'string' ? JSON.parse(row.structured_json) : row.structured_json;
      expect(String(structured.label || '')).toMatch(/confirmed/i);
    }
  });

  test('anonymous → claim rebinds fact to patient (H3 server path)', async () => {
    const anonApp = express();
    registerPatientRecordRoutes(anonApp, {
      apiLimiter: (_req, _res, next) => next(),
      express,
      db: { db },
      requirePatientSession: (_req, res) => res.status(401).json({ success: false }),
      resolvePatientIdFromSession: () => ({ patientId: null }),
      recordPatientPortalEvent: jest.fn(),
    });

    const res = await request(anonApp)
      .post('/api/patient/records/anonymous')
      .send({
        tag: 'mark',
        ai_or_manual: 'manual',
        confirm: true,
        structured_json: { date: '2026-07-16', label: 'pre-auth', body_location: 'arm' },
      });

    expect(res.status).toBe(201);
    expect(res.body.capture_token).toMatch(/^cap_/);
    expect(res.body.fact.patient_id).toBeFalsy();

    const bind = bindCaptureTokenToOtpSession(db, {
      captureToken: res.body.capture_token,
      otpSessionId: 'portal_after_otp',
    });
    expect(bind.ok).toBe(true);

    const claim = claimPendingCaptures(db, {
      captureToken: res.body.capture_token,
      patientId: 'Patient/claimed',
      portalSessionId: 'portal_after_otp',
    });
    expect(claim.claimed).toBe(true);
    expect(claim.facts_claimed).toBeGreaterThanOrEqual(1);
    const fact = factsRepo.getFactById(db, res.body.fact.id);
    expect(fact.patient_id).toBe('Patient/claimed');
    expect(getPendingByToken(db, res.body.capture_token).status).toBe('claimed');
  });

  test('H5 bill path: local upload → downloadBuffer → parseBillingFieldsFromText', async () => {
    const { persistRecordMedia } = require('../services/patient-record-media');
    const { downloadBuffer } = require('../services/gcs-billing-storage');
    const { parseBillingFieldsFromText } = require('../services/billing-ocr-parser');

    const sampleText = 'Total Due: $42.50\nProvider: Demo Clinic\nDate of Service: 07/01/2026';
    const stored = await persistRecordMedia({
      buffer: Buffer.from(sampleText, 'utf8'),
      contentType: 'text/plain',
      sessionId: 'sess_bill',
      fileName: 'bill.txt',
      mediaType: 'pdf',
    });
    expect(stored.storage_ref.startsWith('local://')).toBe(true);
    const bytes = await downloadBuffer(stored.storage_ref);
    const parsed = parseBillingFieldsFromText({
      text: bytes.toString('utf8'),
      mimeType: 'text/plain',
      fileName: 'bill.txt',
    });
    expect(parsed).toBeTruthy();
    expect(String(JSON.stringify(parsed))).toMatch(/42\.50|Demo Clinic|2026/);
  });
});
