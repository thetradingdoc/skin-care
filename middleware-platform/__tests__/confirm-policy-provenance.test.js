'use strict';

/**
 * STEP 1 — Confirm-route policy parity + forged field_provenance adversarial tests.
 * Create-time already rejects diagnosis prose; confirm must match.
 */

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientRecordRoutes } = require('../routes/patient-records');
const factsRepo = require('../repositories/patient-record-facts-repo');
const { ensureTables: ensureMeter } = require('../services/ai-capture-meter');
const {
  createOrGetPending,
  attachFactId,
} = require('../services/pending-capture-claim');
const {
  assertOrchestrationPersistPolicy,
  prepareConfirmStructuredForPersist,
} = require('../services/medical-tracker-rails/policy');

function buildAuthApp(db) {
  const app = express();
  registerPatientRecordRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_confirm_policy';
      req.patientSession = { patient_id: 'Patient/confirm1' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'Patient/confirm1' }),
    recordPatientPortalEvent: jest.fn(),
    resolveBillingSubscription: () => ({
      tier: 'free',
      patientId: 'Patient/confirm1',
      sessionId: 'sess_confirm_policy',
    }),
  });
  return app;
}

function buildAnonApp(db) {
  const app = express();
  registerPatientRecordRoutes(app, {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_unused';
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    recordPatientPortalEvent: jest.fn(),
  });
  return app;
}

function insertSkinDraft(db, { patientId = null, sessionId, note = 'photo only' } = {}) {
  return factsRepo.insertFact(db, {
    patient_id: patientId,
    session_id: sessionId,
    tag: 'skin',
    media_type: 'photo',
    ai_or_manual: 'manual',
    structured_json: {
      date: '2026-07-17',
      body_area: 'cheek',
      note,
    },
    raw_extract_text: null,
    confirmed_at: null,
  });
}

describe('STEP 1 — confirm policy + forged provenance', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    factsRepo.ensurePatientRecordFactsTable(db);
    ensureMeter(db);
    require('../migrations/069_pending_captures').up(db);
    require('../migrations/070_patient_record_media_tokens').up(db);
    require('../migrations/071_capture_sessions').up(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch (_) {}
  });

  test('create-time policy rejects diagnosis note (baseline parity)', () => {
    const policy = assertOrchestrationPersistPolicy('skin', {
      date: '2026-07-17',
      body_area: 'cheek',
      note: 'you have eczema on the cheek',
    });
    expect(policy.ok).toBe(false);
    expect(policy.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('auth PATCH confirm: diagnosis note → DIAGNOSIS_VOCABULARY (parity with create)', async () => {
    const app = buildAuthApp(db);
    const fact = insertSkinDraft(db, {
      patientId: 'Patient/confirm1',
      sessionId: 'sess_confirm_policy',
      note: 'looks fine',
    });

    const res = await request(app)
      .patch(`/api/patient/records/${fact.id}/confirm`)
      .send({
        structured_json: {
          date: '2026-07-17',
          body_area: 'cheek',
          note: 'you have eczema on the cheek',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('DIAGNOSIS_VOCABULARY');
    const row = factsRepo.getFactById(db, fact.id);
    expect(row.confirmed_at).toBeFalsy();
  });

  test('auth POST confirm: diagnosis note → DIAGNOSIS_VOCABULARY', async () => {
    const app = buildAuthApp(db);
    const fact = insertSkinDraft(db, {
      patientId: 'Patient/confirm1',
      sessionId: 'sess_confirm_policy',
    });

    const res = await request(app)
      .post(`/api/patient/records/${fact.id}/confirm`)
      .send({
        structured_json: {
          date: '2026-07-17',
          body_area: 'cheek',
          note: 'this looks like melanoma',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('anonymous PATCH confirm: diagnosis note → DIAGNOSIS_VOCABULARY', async () => {
    const app = buildAnonApp(db);
    const pending = createOrGetPending(db, {});
    const fact = insertSkinDraft(db, { sessionId: pending.anon_session_id });
    attachFactId(db, pending.capture_token, fact.id);

    const res = await request(app)
      .patch(`/api/patient/records/anonymous/${fact.id}/confirm`)
      .send({
        capture_token: pending.capture_token,
        structured_json: {
          date: '2026-07-17',
          body_area: 'cheek',
          note: 'you have eczema on the cheek',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('DIAGNOSIS_VOCABULARY');
    const row = factsRepo.getFactById(db, fact.id);
    expect(row.confirmed_at).toBeFalsy();
  });

  test('ADVERSARIAL: forged field_provenance document on manual diagnosis free_text → rejected', async () => {
    const app = buildAuthApp(db);
    const fact = insertSkinDraft(db, {
      patientId: 'Patient/confirm1',
      sessionId: 'sess_confirm_policy',
    });

    const res = await request(app)
      .patch(`/api/patient/records/${fact.id}/confirm`)
      .send({
        structured_json: {
          date: '2026-07-17',
          body_area: 'cheek',
          note: 'you have eczema on the cheek',
          free_text: 'diagnosed psoriasis yesterday',
          field_provenance: {
            note: 'document',
            free_text: 'document',
          },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('DIAGNOSIS_VOCABULARY');
    const row = factsRepo.getFactById(db, fact.id);
    expect(row.confirmed_at).toBeFalsy();
    expect(row.structured_json?.field_provenance?.note).not.toBe('document');
  });

  test('ADVERSARIAL (anon): forged field_provenance on free_text → DIAGNOSIS_VOCABULARY', async () => {
    const app = buildAnonApp(db);
    const pending = createOrGetPending(db, {});
    const fact = factsRepo.insertFact(db, {
      session_id: pending.anon_session_id,
      tag: 'lab',
      media_type: null,
      ai_or_manual: 'manual',
      structured_json: {
        date: '2026-07-17',
        title: 'Lab',
        free_text: 'CBC within range',
        lab_kind: 'lab',
      },
      confirmed_at: null,
    });
    attachFactId(db, pending.capture_token, fact.id);

    const res = await request(app)
      .patch(`/api/patient/records/anonymous/${fact.id}/confirm`)
      .send({
        capture_token: pending.capture_token,
        structured_json: {
          date: '2026-07-17',
          title: 'Lab',
          lab_kind: 'lab',
          free_text: 'you have eczema based on this panel',
          field_provenance: { free_text: 'document' },
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });

  test('imaging confirm keeps document exemption when Findings unchanged from extract', () => {
    const existing = {
      tag: 'lab',
      structured_json: {
        date: '2025-08-04',
        lab_kind: 'imaging_report',
        findings: 'Medial meniscus lesion with findings suggestive of ramp tear.',
        conclusion: 'Partial ACL graft rupture suspected.',
        field_provenance: { findings: 'document', conclusion: 'document' },
      },
    };
    const prepared = prepareConfirmStructuredForPersist(existing, {
      date: '2025-08-04',
      lab_kind: 'imaging_report',
      findings: existing.structured_json.findings,
      conclusion: existing.structured_json.conclusion,
      // Client forges provenance — ignored / recomputed
      field_provenance: { findings: 'user', note: 'document' },
    });
    expect(prepared.ok).toBe(true);
    expect(prepared.structured.field_provenance.findings).toBe('document');
    expect(prepared.structured.field_provenance.conclusion).toBe('document');
  });

  test('imaging confirm: edited Findings with diagnosis language lose exemption and reject', () => {
    const existing = {
      tag: 'lab',
      structured_json: {
        date: '2025-08-04',
        lab_kind: 'imaging_report',
        findings: 'Normal cartilage.',
        conclusion: 'No acute findings.',
        field_provenance: { findings: 'document', conclusion: 'document' },
      },
    };
    const prepared = prepareConfirmStructuredForPersist(existing, {
      date: '2025-08-04',
      lab_kind: 'imaging_report',
      findings: 'you have eczema visible on MRI',
      conclusion: 'No acute findings.',
      field_provenance: { findings: 'document', conclusion: 'document' },
    });
    expect(prepared.ok).toBe(false);
    expect(prepared.policy.error_code).toBe('DIAGNOSIS_VOCABULARY');
  });
});
