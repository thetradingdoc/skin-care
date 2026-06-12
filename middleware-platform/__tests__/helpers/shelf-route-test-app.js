'use strict';

const express = require('express');
const { registerPatientShelfRoutes } = require('../../routes/patient-shelf');
const { registerPatientRoutineRoutes } = require('../../routes/patient-routine');
const { safeParseJsonArray } = require('../../lib/patient-portal-shared');

function formatShelfProductApiRow(r) {
  return {
    id: r.id,
    product_name: r.custom_product_name || r.product_name || 'Product',
    selection_mode: r.selection_mode,
    catalog_product_id: r.catalog_product_id,
    category: r.category,
    usage_time: r.usage_time,
    goal: r.goal,
    inventory_status: r.inventory_status,
    key_ingredients: r.key_ingredients,
    updated_at: r.updated_at,
  };
}

function buildShelfRouteApp(sqliteDb, sessionId = 'sess_route_test') {
  function loadPatientShelfProductRows(sid) {
    return sqliteDb
      .prepare(
        `SELECT id, selection_mode, catalog_product_id, custom_product_name, category, usage_time,
          goal, inventory_status, key_ingredients, ingredients_text, ingredient_canonical_ids_json,
          barcode, updated_at
        FROM patient_onboarding_step3_products WHERE session_id = ? ORDER BY datetime(updated_at) DESC`,
      )
      .all(sid);
  }

  const baseDeps = {
    apiLimiter: (_req, _res, next) => next(),
    express,
    db: { db: sqliteDb },
    requirePatientSession: (req, _res, next) => {
      req.patientSessionId = sessionId;
      req.patientSession = {};
      next();
    },
    resolvePatientIdFromSession: () => ({ patientId: null }),
    recordPatientPortalEvent: jest.fn(),
    ensureRoutineTables: jest.fn(),
    ensurePatientShelfInventoryColumns: jest.fn(),
    loadPatientShelfProductRows,
    formatShelfProductApiRow,
    safeParseJsonArray,
    isIsoDateOnly: (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')),
  };

  const app = express();
  registerPatientShelfRoutes(app, baseDeps);
  registerPatientRoutineRoutes(app, {
    ...baseDeps,
    ensureBillingTables: jest.fn(),
    parseBillingDocumentUpload: jest.fn(),
    localDateFromIso: jest.fn(),
    isoFromLocalDate: jest.fn(),
    weekdayKeyForIsoLocal: jest.fn(),
    enumerateIsoDates: jest.fn(),
    issuePatientDocumentDownloadUrl: jest.fn(),
    fetchBillingAggregatesByDay: jest.fn(),
    fieldsFromSqlAggRow: jest.fn(),
    PatientPortalService: {},
    billingOk: jest.fn(),
    billingErr: jest.fn(),
    resolveBillingSubscription: jest.fn(),
    requirePlusForBillingFeature: jest.fn(),
    getPatientStep3Status: jest.fn(),
    ensureProductsPhase2Tables: jest.fn(),
    blockWalletWhenDisabled: jest.fn(),
    blockChatWhenDisabled: jest.fn(),
    isPatientWalletEnabled: jest.fn(),
    isPatientChatEnabled: jest.fn(),
    parseBooleanFlag: jest.fn(),
    withIdempotency: jest.fn(),
    assertPatientOwnsAppointmentOrThrow: jest.fn(),
    validatePatientAvailableSlotsQuery: jest.fn(),
    validatePatientBookingScheduleBody: jest.fn(),
    validatePatientTriageBody: jest.fn(),
    requireCsrfForCookieAuth: jest.fn(),
    auditBookingEvent: jest.fn(),
    botGuard: jest.fn(),
    authLimiter: jest.fn(),
    otpSendLimiter: jest.fn(),
    otpConfirmLimiter: jest.fn(),
  });
  return app;
}

module.exports = { buildShelfRouteApp, formatShelfProductApiRow };
