'use strict';

const { validateRequired, validateDate, combineValidators } = require('../middleware/input-validator');

function isValidIanaTimezone(value) {
  const tz = (value || '').toString().trim();
  if (!tz) return false;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch (_) {
    return false;
  }
}

function parseIsoDateFromText(text) {
  const t = (text || '').toString();
  const m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return m[0];
  const lower = t.toLowerCase();
  if (lower.includes('tomorrow')) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  if (lower.includes('today')) return new Date().toISOString().slice(0, 10);
  return null;
}

function parseTimeFromText(text) {
  const t = (text || '').toString().toLowerCase();
  const m24 = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m24) return `${m24[1].padStart(2, '0')}:${m24[2]}`;
  const m12 = t.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const ampm = m12[3];
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return null;
}

function createPatientValidators(db) {
  const validatePatientBookingScheduleBody = combineValidators(
    validateRequired(['date', 'time']),
    validateDate('date')
  );
  const validatePatientTriageBody = validateRequired(['message']);

  function validatePatientCheckoutChatBody(req, res, next) {
    const b = req.body || {};
    const msg = (b.message || '').toString().trim();
    if (!msg) {
      return res.status(400).json({ success: false, error: 'message is required', request_id: req.id });
    }
    if (msg.length > 4000) {
      return res.status(400).json({ success: false, error: 'message too long (max 4000 characters)', request_id: req.id });
    }
    const pid = (b.product_id || '').toString().trim();
    const provid = (b.provider_id || '').toString().trim();
    if (!pid) {
      return res.status(400).json({ success: false, error: 'product_id is required', request_id: req.id });
    }
    if (!provid) {
      return res.status(400).json({ success: false, error: 'provider_id is required', request_id: req.id });
    }
    return next();
  }

  function validatePatientAvailableSlotsQuery(req, res, next) {
    const date = (req.query?.date || '').toString().trim();
    if (!date) {
      return res.status(400).json({ success: false, error: 'date query parameter is required', request_id: req.id });
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.', request_id: req.id });
    }
    return next();
  }

  function auditBookingEvent(req, action, resourceType, resourceId, result = 'success') {
    try {
      if (db.auditLog) {
        db.auditLog(
          'patient',
          req?.patientSession?.patient_id || req?.patientSessionId || 'unknown',
          action,
          resourceType,
          resourceId,
          req.ip,
          req.get('User-Agent') || '',
          result
        );
      }
    } catch (_) {}
  }

  return {
    validatePatientBookingScheduleBody,
    validatePatientTriageBody,
    validatePatientCheckoutChatBody,
    validatePatientAvailableSlotsQuery,
    auditBookingEvent,
    parseIsoDateFromText,
    parseTimeFromText,
  };
}

function createBasePatientRouteDeps(ctx) {
  const shelfApi = ctx.shelfApi;
  return {
    apiLimiter: ctx.apiLimiter,
    express: ctx.express,
    db: ctx.db,
    requirePatientSession: ctx.requirePatientSession,
    resolvePatientIdFromSession: ctx.resolvePatientIdFromSession,
    recordPatientPortalEvent: ctx.recordPatientPortalEvent,
    ensureRoutineTables: ctx.ensureRoutineTables,
    ensureJournalTables: ctx.ensureJournalTables,
    ensureBillingTables: ctx.ensureBillingTables,
    ensurePatientShelfInventoryColumns: shelfApi.ensurePatientShelfInventoryColumns,
    loadPatientShelfProductRows: shelfApi.loadPatientShelfProductRows,
    formatShelfProductApiRow: shelfApi.formatShelfProductApiRow,
    parseBillingDocumentUpload: ctx.parseBillingDocumentUpload,
    safeParseJsonArray: ctx.safeParseJsonArray,
    isIsoDateOnly: ctx.isIsoDateOnly,
    localDateFromIso: ctx.localDateFromIso,
    isoFromLocalDate: ctx.isoFromLocalDate,
    weekdayKeyForIsoLocal: ctx.weekdayKeyForIsoLocal,
    enumerateIsoDates: ctx.enumerateIsoDates,
    issuePatientDocumentDownloadUrl: ctx.issuePatientDocumentDownloadUrl,
    fetchBillingAggregatesByDay: ctx.fetchBillingAggregatesByDay,
    fieldsFromSqlAggRow: ctx.fieldsFromSqlAggRow,
    PatientPortalService: ctx.PatientPortalService,
    billingOk: ctx.billingOk,
    billingErr: ctx.billingErr,
    resolveBillingSubscription: ctx.resolveBillingSubscription,
    requirePlusForBillingFeature: ctx.requirePlusForBillingFeature,
    getPatientStep3Status: ctx.getPatientStep3Status,
    issueCsrfCookie: ctx.issueCsrfCookie,
    PatientIntakeService: ctx.PatientIntakeService,
    ensureProductsPhase2Tables: ctx.ensureProductsPhase2Tables,
    blockWalletWhenDisabled: ctx.blockWalletWhenDisabled,
    blockChatWhenDisabled: ctx.blockChatWhenDisabled,
    isPatientWalletEnabled: ctx.isPatientWalletEnabled,
    isPatientChatEnabled: ctx.isPatientChatEnabled,
    parseBooleanFlag: ctx.parseBooleanFlag,
    withIdempotency: ctx.withIdempotency,
    assertPatientOwnsAppointmentOrThrow: ctx.assertPatientOwnsAppointmentOrThrow,
    requireCsrfForCookieAuth: ctx.requireCsrfForCookieAuth,
    rotatePatientSessionIfNeeded: ctx.rotatePatientSessionIfNeeded,
    resolveClinicIdFromRequest: ctx.resolveClinicIdFromRequest,
    FALLBACK_CLINIC_ID: ctx.FALLBACK_CLINIC_ID,
    botGuard: ctx.botGuard,
    authLimiter: ctx.authLimiter,
    listCatalogFromIndex: ctx.listCatalogFromIndex,
    parseProductRef: ctx.parseProductRef,
  };
}

function enrichPatientRouteDeps(patientRouteDeps, validators, limiters) {
  return Object.assign(patientRouteDeps, validators, limiters);
}

function createPatientPortalDeps(patientRouteDeps, extra) {
  return { ...patientRouteDeps, ...extra };
}

module.exports = {
  isValidIanaTimezone,
  createPatientValidators,
  createBasePatientRouteDeps,
  enrichPatientRouteDeps,
  createPatientPortalDeps,
};
