'use strict';

/**
 * P5.13 / P5.14 — Unified alerts feed decision + ownership-scoped feed.
 * Surfaces: Progress module + Shelf hard_no/conflict badge + push.
 * No dedicated alerts tab as product home (API decision layer).
 */

const { buildPatientAlerts } = require('../patient-alerts-service');
const factsRepo = require('../../repositories/patient-record-facts-repo');
const { computeFactsAgentDelta } = require('./agent-delta-facts');
const { daysUntil } = require('./reminder-jobs');

/** Locked product decision (P5.13) — checkable constant. */
const ALERTS_HOME_DECISION = Object.freeze({
  dedicated_tab: false,
  surfaces: Object.freeze(['progress_module', 'shelf_hard_no_conflict_badge', 'push']),
  empty_redirect_to_check_retired: true,
  notes:
    'Alerts live on Progress + Shelf badges + push. No dedicated tab as home. UI (P7.47) must not empty-redirect to Check.',
});

function requireOwner({ patientId, sessionId }) {
  if (!patientId && !sessionId) {
    const err = new Error('OWNER_REQUIRED');
    err.code = 'OWNER_REQUIRED';
    throw err;
  }
}

/**
 * P5.14 — Unified feed: allergen conflicts + Rx expiry + agent-delta.
 * Every item must carry patient_id matching the requester (or null only for session-only shelf).
 */
function buildUnifiedAlertsFeed(db, { patientId = null, sessionId = null, todayIso = null } = {}) {
  requireOwner({ patientId, sessionId });
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const items = [];

  // Shelf / allergen (existing) — scoped by session/patient inside evaluate
  const shelf = buildPatientAlerts(db, { sessionId, patientId });
  for (const a of shelf.alerts || []) {
    items.push({
      ...a,
      patient_id: patientId || null,
      source: 'shelf_evaluate',
    });
  }

  // Rx expiry from owned prescription facts
  if (patientId) {
    factsRepo.ensurePatientRecordFactsTable(db);
    const rxFacts = factsRepo
      .listFacts(db, { patientId, tag: 'prescription', limit: 100 })
      .filter((f) => f.confirmed_at && f.patient_id === patientId);
    for (const f of rxFacts) {
      if (f.patient_id !== patientId) {
        const err = new Error('OWNERSHIP_VIOLATION');
        err.code = 'OWNERSHIP_VIOLATION';
        throw err;
      }
      if (f.structured_json?.reminder_opt_in !== true) continue;
      // Prefer 075 denorm; JSON fallback only when backfill could not populate
      const expiry =
        f.expiry_date || f.structured_json?.expiry || f.structured_json?.expiry_date || null;
      const left = daysUntil(expiry, today);
      if (left == null || left > 14) continue;
      items.push({
        id: `rx_expiry_${f.id}`,
        kind: 'rx_expiry',
        severity: left <= 0 ? 'hard_no' : 'caution',
        title: left <= 0 ? 'Prescription expired' : 'Prescription expiring',
        message: `${f.structured_json?.drug || 'Rx'} · ${left <= 0 ? 'past expiry' : `${left} days left`}`,
        product_id: null,
        fact_id: f.id,
        patient_id: patientId,
        source: 'patient_record_facts',
      });
    }
  }

  // Agent-delta from facts
  try {
    const delta = computeFactsAgentDelta(db, { patientId, sessionId, todayIso: today });
    if (delta.show && delta.message) {
      items.push({
        id: `agent_delta_${today}`,
        kind: 'agent_delta',
        severity: 'caution',
        title: 'Skin check-in',
        message: delta.message,
        product_id: null,
        patient_id: patientId || null,
        source: 'patient_record_facts',
        n_day_worse: delta.n_day_worse,
        product_cooccurrence: delta.product_cooccurrence,
      });
    }
  } catch (e) {
    if (e.code === 'OWNER_REQUIRED' || e.code === 'TODAY_ISO_REQUIRED') throw e;
    // Other errors fail loud for ownership; soft for empty facts path
    if (e.code === 'OWNERSHIP_VIOLATION') throw e;
  }

  // Ownership audit on every item with patient_id
  for (const item of items) {
    if (item.patient_id && patientId && item.patient_id !== patientId) {
      const err = new Error('OWNERSHIP_VIOLATION');
      err.code = 'OWNERSHIP_VIOLATION';
      err.alert_id = item.id;
      throw err;
    }
  }

  items.sort((a, b) => {
    const rank = (s) => (s === 'hard_no' ? 0 : 1);
    return rank(a.severity) - rank(b.severity);
  });

  return {
    success: true,
    count: items.length,
    alerts: items,
    home_decision: ALERTS_HOME_DECISION,
  };
}

module.exports = {
  ALERTS_HOME_DECISION,
  buildUnifiedAlertsFeed,
};
