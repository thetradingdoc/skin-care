'use strict';

const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const { registerPatientRoutineRoutes } = require('../routes/patient-routine');
const { ensureRoutineTables } = require('../lib/patient-routine-db');
const { ensureJournalTables } = require('../lib/patient-journal-db');
const { upsertEntry } = require('../repositories/patient-journal-repo');

function buildApp(db) {
  const app = express();
  const noopMw = (_req, _res, next) => next();
  const noopFn = () => {};
  registerPatientRoutineRoutes(app, {
    apiLimiter: noopMw,
    express,
    db: { db },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_cal_merge';
      req.patientSession = {};
      req.headers = { 'x-client-date': '2026-06-12' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    recordPatientPortalEvent: jest.fn(),
    ensureRoutineTables: () => ensureRoutineTables(),
    ensureBillingTables: noopFn,
    ensurePatientShelfInventoryColumns: noopFn,
    loadPatientShelfProductRows: () => [],
    formatShelfProductApiRow: (r) => r,
    parseBillingDocumentUpload: noopMw,
    safeParseJsonArray: (v) => (Array.isArray(v) ? v : []),
    isIsoDateOnly: (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '').trim()),
    localDateFromIso: (iso) => new Date(`${iso}T12:00:00.000Z`),
    isoFromLocalDate: (d) => d.toISOString().slice(0, 10),
    weekdayKeyForIsoLocal: () => 'monday',
    enumerateIsoDates: (start, end) => {
      const out = [];
      let d = new Date(`${start}T12:00:00.000Z`);
      const endD = new Date(`${end}T12:00:00.000Z`);
      while (d <= endD) {
        out.push(d.toISOString().slice(0, 10));
        d = new Date(d.getTime());
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return out;
    },
    issuePatientDocumentDownloadUrl: () => null,
    fetchBillingAggregatesByDay: () => [],
    fieldsFromSqlAggRow: () => ({}),
    PatientPortalService: {},
    billingOk: noopMw,
    billingErr: noopMw,
    resolveBillingSubscription: () => null,
    requirePlusForBillingFeature: noopFn,
    getPatientStep3Status: () => ({}),
    ensureProductsPhase2Tables: noopFn,
    blockWalletWhenDisabled: noopFn,
    blockChatWhenDisabled: noopFn,
    isPatientWalletEnabled: () => false,
    isPatientChatEnabled: () => false,
    parseBooleanFlag: () => false,
    withIdempotency: (h) => h,
    assertPatientOwnsAppointmentOrThrow: noopFn,
    validatePatientAvailableSlotsQuery: noopMw,
    validatePatientBookingScheduleBody: noopMw,
    validatePatientTriageBody: noopMw,
    requireCsrfForCookieAuth: noopMw,
    auditBookingEvent: noopFn,
    botGuard: noopMw,
    authLimiter: noopMw,
    otpSendLimiter: noopMw,
    otpConfirmLimiter: noopMw,
  });
  return app;
}

describe('journal calendar merge', () => {
  let db;
  let app;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS patient_routine_templates (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL, patient_id TEXT, name TEXT NOT NULL,
        start_date TEXT, duration_days INTEGER DEFAULT 28, repeat_cadence TEXT DEFAULT 'daily',
        repeat_days_of_week_json TEXT, is_active INTEGER DEFAULT 1, concern_id TEXT,
        metadata_json TEXT, created_at TEXT, updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_routine_daily_entries (
        id TEXT PRIMARY KEY, template_id TEXT NOT NULL, session_id TEXT NOT NULL, patient_id TEXT,
        entry_date TEXT NOT NULL, skin_report TEXT, notes TEXT, completion_score INTEGER DEFAULT 0,
        created_at TEXT, updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS patient_routine_daily_media (
        id TEXT PRIMARY KEY, daily_entry_id TEXT NOT NULL, media_type TEXT DEFAULT 'image',
        patient_document_id TEXT, media_url TEXT, created_at TEXT, updated_at TEXT
      );
    `);
    ensureJournalTables(db);
    app = buildApp(db);
    upsertEntry(db, {
      patientId: null,
      sessionId: 'sess_cal_merge',
      entryDate: '2026-06-10',
      photoStorageRef: 'gs://bucket/face.jpg',
      conditionTags: ['calm'],
      note: 'good day',
      source: 'standalone',
    });
  });

  afterEach(() => {
    db.close();
  });

  test('calendar-range without template includes journal photos', async () => {
    const res = await request(app).get(
      '/api/patient/journal/calendar-range?start=2026-06-08&end=2026-06-12&include_empty_days=1',
    );
    expect(res.status).toBe(200);
    expect(res.body.has_template).toBe(false);
    expect(res.body.journal_mode).toBe(true);
    const day = res.body.days.find((d) => d.date === '2026-06-10');
    expect(day).toBeTruthy();
    expect(day.has_media).toBe(true);
    expect(day.thumbnail_url).toBe('gs://bucket/face.jpg');
  });

  test('progress-summary without template returns journal streak', async () => {
    const res = await request(app).get('/api/patient/home/progress-summary');
    expect(res.status).toBe(200);
    expect(res.body.journal_mode).toBe(true);
    expect(res.body.summary.journal_days_logged).toBeGreaterThanOrEqual(1);
  });
});
