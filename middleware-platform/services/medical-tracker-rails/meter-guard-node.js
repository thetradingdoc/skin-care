'use strict';

/**
 * P4.06 — meter_guard as a shared graph/pre-node for every medical AI path.
 * Do not reimplement tryConsume inside capture_compose / delta_compose.
 */

const {
  meterGuard: tryMeter,
  meterRefund,
  meterRecordTokens,
} = require('../capture-orchestration/meter-guard');

/**
 * Pre-node: consume meter before AI work.
 * Returns { ok, usageId, gate } or { ok:false, status, body }.
 */
function meterGuardNode(db, {
  patientId,
  sessionId,
  captureKind,
  isPlus = false,
  model = null,
  aiOrManual = 'ai',
} = {}) {
  if (String(aiOrManual).toLowerCase() === 'manual') {
    return { ok: true, skipped: true, reason: 'manual_path', usageId: null };
  }
  const gate = tryMeter(db, { patientId, sessionId, captureKind, isPlus, model });
  if (!gate.ok) {
    return {
      ok: false,
      status: gate.status,
      body: gate.body,
      usageId: null,
      gate,
    };
  }
  return { ok: true, usageId: gate.usageId, source: gate.source, gate };
}

function meterGuardRefund(db, usageId, reason) {
  return meterRefund(db, usageId, reason);
}

function meterGuardRecordTokens(db, usageId, tokens) {
  return meterRecordTokens(db, usageId, tokens);
}

module.exports = {
  meterGuardNode,
  meterGuardRefund,
  meterGuardRecordTokens,
};
