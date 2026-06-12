'use strict';

function registerPatientBioProfileRoutes(app, deps) {
  const { apiLimiter, express, db, requirePatientSession, resolvePatientIdFromSession, recordPatientPortalEvent } =
    deps;
  const bio = require('../services/patient-bio-profile-service');

  app.get(
    '/api/patient/bio-profile',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const profile = bio.getBioProfile(db.db, { sessionId, patientId });
        return res.json({
          success: true,
          profile: profile || {
            conditions: [],
            prescriptions: [],
            sensitivity: 'none',
            profile_complete: false,
          },
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }
  );

  function handleBioProfileWrite(req, res) {
    try {
      const sessionId = req.patientSessionId;
      const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const profile = bio.upsertBioProfile(db.db, {
        sessionId,
        patientId,
        patch: {
          conditions: body.conditions,
          prescriptions: body.prescriptions,
          sensitivity: body.sensitivity,
          fitzpatrick: body.fitzpatrick,
          zip: body.zip,
          profile_complete: body.profile_complete,
        },
      });
      recordPatientPortalEvent(req, 'bio_profile_updated', {
        conditions_count: (profile?.conditions || []).length,
      });
      return res.json({ success: true, profile });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  app.put(
    '/api/patient/bio-profile',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    handleBioProfileWrite,
  );

  app.post(
    '/api/patient/bio-profile',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    handleBioProfileWrite,
  );
}

module.exports = { registerPatientBioProfileRoutes };
