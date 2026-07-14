'use strict';

/**
 * TOUCH-066/068 — Alerts list + count for Check bell badge.
 */

const { buildPatientAlerts } = require('../services/patient-alerts-service');
const { computeSafeMode } = require('../services/safe-mode-service');
const { getBioProfile } = require('../services/patient-bio-profile-service');

function registerPatientAlertsRoutes(app, deps) {
  const { apiLimiter, db, requirePatientSession, resolvePatientIdFromSession } = deps;

  app.get('/api/patient/alerts', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const sessionId = req.patientSessionId;
      const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
      const payload = buildPatientAlerts(db.db, { sessionId, patientId });
      return res.json({ success: true, ...payload });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/patient/alerts/count', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const sessionId = req.patientSessionId;
      const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
      const payload = buildPatientAlerts(db.db, { sessionId, patientId });
      return res.json({ success: true, count: payload.count });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  /** TOUCH-101 — Check ambient safe-mode copy */
  app.get('/api/patient/check/safe-mode', apiLimiter, requirePatientSession, (req, res) => {
    try {
      const sessionId = req.patientSessionId;
      const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
      const profile = getBioProfile(db.db, { sessionId, patientId }) || {};
      const safe_mode = computeSafeMode(profile);
      return res.json({ success: true, safe_mode });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { registerPatientAlertsRoutes };
