'use strict';

jest.mock('../services/care-program-billing-service', () => ({
  createCareProgramCheckout: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { registerPatientBillingPortalRoutes } = require('../routes/patient-billing-portal');
const { createCareProgramCheckout } = require('../services/care-program-billing-service');

function billingOk(res, payload) {
  return res.json({ success: true, ...payload });
}

function billingErr(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}

function buildAppDeps() {
  return {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db: null },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = 'sess_care_checkout';
      req.patientSession = { email: 'user@example.com' };
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: 'patient-1' }),
    recordPatientPortalEvent: jest.fn(),
    ensureRoutineTables: jest.fn(),
    ensureBillingTables: jest.fn(),
    ensurePatientShelfInventoryColumns: jest.fn(),
    loadPatientShelfProductRows: jest.fn(() => []),
    formatShelfProductApiRow: jest.fn((row) => row),
    parseBillingDocumentUpload: (_req, _res, next) => next(),
    safeParseJsonArray: jest.fn(() => []),
    isIsoDateOnly: jest.fn(() => true),
    localDateFromIso: jest.fn(),
    isoFromLocalDate: jest.fn(),
    weekdayKeyForIsoLocal: jest.fn(),
    enumerateIsoDates: jest.fn(() => []),
    issuePatientDocumentDownloadUrl: jest.fn(),
    fetchBillingAggregatesByDay: jest.fn(() => []),
    fieldsFromSqlAggRow: jest.fn(() => ({})),
    PatientPortalService: {},
    billingOk,
    billingErr,
    resolveBillingSubscription: jest.fn(() => ({
      tier: 'free',
      status: 'active',
      sessionId: 'sess_care_checkout',
      patientId: 'patient-1',
    })),
    requirePlusForBillingFeature: () => (_req, _res, next) => next(),
    getPatientStep3Status: jest.fn(),
    ensureProductsPhase2Tables: jest.fn(),
    blockWalletWhenDisabled: (_req, _res, next) => next(),
    blockChatWhenDisabled: (_req, _res, next) => next(),
    isPatientWalletEnabled: jest.fn(() => false),
    isPatientChatEnabled: jest.fn(() => false),
    parseBooleanFlag: jest.fn((_v, d) => d),
    withIdempotency: jest.fn((_req, _res, next) => next()),
    assertPatientOwnsAppointmentOrThrow: jest.fn(),
    validatePatientAvailableSlotsQuery: jest.fn(),
    validatePatientBookingScheduleBody: jest.fn(),
    validatePatientTriageBody: jest.fn(),
    requireCsrfForCookieAuth: (_req, _res, next) => next(),
    auditBookingEvent: jest.fn(),
    botGuard: (_req, _res, next) => next(),
    authLimiter: (_req, _res, next) => next(),
    otpSendLimiter: (_req, _res, next) => next(),
    otpConfirmLimiter: (_req, _res, next) => next(),
  };
}

function buildApp() {
  const app = express();
  registerPatientBillingPortalRoutes(app, buildAppDeps());
  return app;
}

describe('POST /api/patient/billing/care-program/checkout', () => {
  beforeEach(() => {
    jest.mocked(createCareProgramCheckout).mockReset();
  });

  test('returns checkout_url on success', async () => {
    jest.mocked(createCareProgramCheckout).mockResolvedValue({
      success: true,
      checkout_url: 'https://checkout.stripe.com/test',
      session_id: 'cs_test_1',
    });

    const res = await request(buildApp())
      .post('/api/patient/billing/care-program/checkout')
      .send({ email: 'user@example.com', concern_id: 'acne' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.checkout_url).toContain('stripe.com');
    expect(createCareProgramCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess_care_checkout',
        email: 'user@example.com',
        concernId: 'acne',
      }),
    );
  });

  test('returns 500 when STRIPE_PRICE_CARE_PROGRAM is missing', async () => {
    jest
      .mocked(createCareProgramCheckout)
      .mockRejectedValue(new Error('STRIPE_PRICE_CARE_PROGRAM is not configured'));

    const res = await request(buildApp())
      .post('/api/patient/billing/care-program/checkout')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('STRIPE_PRICE_CARE_PROGRAM');
  });

  test('returns 400 when email missing', async () => {
    const app = express();
    registerPatientBillingPortalRoutes(app, {
      ...buildAppDeps(),
      requirePatientSession: (req, _res, next) => {
        req.patientSessionId = 'sess_care_checkout';
        req.patientSession = {};
        next();
      },
    });

    const res = await request(app).post('/api/patient/billing/care-program/checkout').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
