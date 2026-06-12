'use strict';

const {
  getConsumerProfile,
  upsertConsumerProfile,
  toApiProfile,
} = require('../repositories/consumer-profile-repo');

function registerPatientConsumerProfileRoutes(app, deps) {
  const { apiLimiter, express, db, requirePatientSession, resolvePatientIdFromSession, recordPatientPortalEvent } =
    deps;

  app.get(
    '/api/patient/consumer-profile',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const profile = await getConsumerProfile(db.db, { patientId, sessionId });
        return res.json({ success: true, profile: toApiProfile(profile) });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.patch(
    '/api/patient/consumer-profile',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const patch = {};

        if (body.journey_modes != null || body.modes != null) {
          patch.journey_modes = body.journey_modes ?? body.modes;
        }
        if (body.primary_mode != null || body.primary != null) {
          patch.primary_mode = body.primary_mode ?? body.primary;
        }
        if (body.onboarding_complete != null) patch.onboarding_complete = Boolean(body.onboarding_complete);
        if (body.bio_calibration_complete != null) {
          patch.bio_calibration_complete = Boolean(body.bio_calibration_complete);
        }
        if (body.needs_first_photo != null) patch.needs_first_photo = Boolean(body.needs_first_photo);
        if (body.chosen_at != null || body.chosenAt != null) {
          patch.chosen_at = body.chosen_at ?? body.chosenAt;
        }

        const profile = await upsertConsumerProfile(db.db, { patientId, sessionId, patch });
        let goalsSeeded = null;
        if (patch.journey_modes != null || patch.modes != null) {
          try {
            const { seedDefaultGoals } = require('../repositories/patient-goals-repo');
            await seedDefaultGoals(db.db, {
              patientId,
              sessionId,
              journeyModes: profile?.journey_modes,
            });
            goalsSeeded = true;
          } catch (seedErr) {
            goalsSeeded = false;
            console.warn('[consumer-profile] goals_seed_failed:', seedErr.message);
            if (typeof recordPatientPortalEvent === 'function') {
              recordPatientPortalEvent(req, 'goals_seed_failed', { error: seedErr.message });
            }
          }
        }
        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'consumer_profile_updated', {
            primary_mode: profile?.primary_mode,
            modes: profile?.journey_modes,
          });
        }
        const responseBody = { success: true, profile: toApiProfile(profile) };
        if (goalsSeeded != null) responseBody.goals_seeded = goalsSeeded;
        return res.json(responseBody);
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientConsumerProfileRoutes };
