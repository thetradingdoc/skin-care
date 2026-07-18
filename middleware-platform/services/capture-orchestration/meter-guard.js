'use strict';

/**
 * P3.02 — Meter guard wrapper for capture orchestration.
 */

const meter = require('../ai-capture-meter');

function meterGuard(db, { patientId, sessionId, captureKind, isPlus = false, model = null }) {
  return meter.tryConsume(db, { patientId, sessionId, captureKind, isPlus, model });
}

function meterRefund(db, usageId, reason) {
  return meter.refundFailedIfNeeded(db, usageId, { reason });
}

function meterRecordTokens(db, usageId, tokens) {
  return meter.recordUsageTokens(db, usageId, tokens || {});
}

module.exports = { meterGuard, meterRefund, meterRecordTokens };
