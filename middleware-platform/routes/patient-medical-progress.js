'use strict';

/**
 * Phase 5 — Progress / calendar / marks / physician export / alerts feed routes.
 */

const { buildProgressAggregates } = require('../services/medical-tracker-domain/progress-aggregates');
const { buildFactsCalendar } = require('../services/medical-tracker-domain/facts-calendar');
const {
  listMarksForPatient,
  getCompareGroupTimeline,
} = require('../services/medical-tracker-domain/marks-compare');
const { buildPhysicianPdf } = require('../services/medical-tracker-domain/physician-export-pdf');
const {
  createPhysicianShareLink,
  resolvePhysicianShare,
  revokePhysicianShare,
  listPhysicianShares,
} = require('../services/medical-tracker-domain/physician-share-links');
const {
  buildUnifiedAlertsFeed,
  ALERTS_HOME_DECISION,
} = require('../services/medical-tracker-domain/alerts-feed');
const {
  setRoutineReminderOptIn,
  hasRoutineReminderOptIn,
} = require('../services/medical-tracker-domain/reminder-jobs');

function registerPatientMedicalProgressRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
  } = deps;

  function owner(req) {
    const sessionId = req.patientSessionId;
    const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
    return { patientId: patientId || null, sessionId };
  }

  function fail(res, e, fallback = 500) {
    const status = e.status || (e.code === 'OWNER_REQUIRED' || e.code === 'PATIENT_ID_REQUIRED' ? 401 : fallback);
    const code = e.code || 'ERROR';
    if (code === 'OWNERSHIP_VIOLATION') {
      return res.status(403).json({ success: false, error_code: code, error: e.message });
    }
    if (code === 'SHARE_NOT_FOUND') return res.status(404).json({ success: false, error_code: code });
    if (code === 'SHARE_EXPIRED' || code === 'SHARE_REVOKED') {
      return res.status(410).json({ success: false, error_code: code });
    }
    return res.status(status).json({ success: false, error_code: code, error: e.message });
  }

  /** P5.08 / P5.09 */
  app.get(
    '/api/patient/progress/aggregates',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId, sessionId } = owner(req);
        const payload = buildProgressAggregates(db.db, { patientId, sessionId });
        return res.json(payload);
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** P5.10 */
  app.get(
    '/api/patient/records/calendar',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId, sessionId } = owner(req);
        const payload = buildFactsCalendar(db.db, {
          patientId,
          sessionId,
          start: req.query.start || null,
          end: req.query.end || null,
          month: req.query.month || null,
        });
        return res.json(payload);
      } catch (e) {
        return fail(res, e, e.code === 'RANGE_REQUIRED' ? 400 : 500);
      }
    },
  );

  /** P5.11 */
  app.get(
    '/api/patient/marks',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        return res.json(listMarksForPatient(db.db, { patientId }));
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** P5.12 */
  app.get(
    '/api/patient/marks/compare-group/:compareGroupId',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        return res.json(
          getCompareGroupTimeline(db.db, {
            patientId,
            compareGroupId: req.params.compareGroupId,
          }),
        );
      } catch (e) {
        return fail(res, e, e.code === 'COMPARE_GROUP_ID_REQUIRED' ? 400 : 500);
      }
    },
  );

  /** P5.06 */
  app.get(
    '/api/patient/export/physician.pdf',
    apiLimiter,
    requirePatientSession,
    async (req, res) => {
      try {
        const { patientId, sessionId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const built = await buildPhysicianPdf(db.db, {
          patientId,
          sessionId,
          start: req.query.start || null,
          end: req.query.end || null,
        });
        if (!built.ok) {
          return res.status(400).json({ success: false, error_code: built.error_code });
        }
        res.setHeader('Content-Type', built.content_type);
        res.setHeader('Content-Disposition', 'attachment; filename="touche-physician-pack.pdf"');
        return res.send(built.buffer);
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** P5.07 — create expiring share link (reusable until TTL or revoke) */
  app.post(
    '/api/patient/export/physician-share',
    apiLimiter,
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const link = await createPhysicianShareLink(db.db, {
          patientId,
          ttlSec: req.body?.ttl_sec,
          baseUrl,
        });
        if (!link.ok) {
          return res.status(400).json({ success: false, error_code: link.error_code });
        }
        return res.json({ success: true, ...link });
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** List share links for the signed-in patient */
  app.get(
    '/api/patient/export/physician-shares',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        return res.json(listPhysicianShares(db.db, { patientId }));
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** Revoke a share link before TTL */
  app.post(
    '/api/patient/export/physician-share/:token/revoke',
    apiLimiter,
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const result = revokePhysicianShare(db.db, {
          token: req.params.token,
          patientId,
        });
        return res.json({ success: true, ...result });
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  /** P5.07 — public resolve (token + expiry); access audited */
  app.get('/api/public/physician-share/:token', apiLimiter, async (req, res) => {
    try {
      const resolved = await resolvePhysicianShare(db.db, {
        token: req.params.token,
        ip: req.ip || req.connection?.remoteAddress || null,
        userAgent: req.get('User-Agent') || null,
      });
      res.setHeader('Content-Type', resolved.content_type);
      res.setHeader('Content-Disposition', 'inline; filename="touche-physician-pack.pdf"');
      return res.send(resolved.buffer);
    } catch (e) {
      return fail(res, e);
    }
  });

  /** P5.13 / P5.14 — unified alerts feed */
  app.get(
    '/api/patient/alerts/feed',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId, sessionId } = owner(req);
        const payload = buildUnifiedAlertsFeed(db.db, { patientId, sessionId });
        return res.json(payload);
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  app.get('/api/patient/alerts/home-decision', apiLimiter, (req, res) => {
    return res.json({ success: true, home_decision: ALERTS_HOME_DECISION });
  });

  /** P5.04 opt-in toggle */
  app.post(
    '/api/patient/reminders/routine-opt-in',
    apiLimiter,
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        if (!patientId) {
          return res.status(401).json({ success: false, error_code: 'PATIENT_ID_REQUIRED' });
        }
        const optIn = Boolean(req.body?.opt_in);
        const result = setRoutineReminderOptIn(db.db, { patientId, optIn });
        return res.json({ success: true, ...result });
      } catch (e) {
        return fail(res, e);
      }
    },
  );

  app.get(
    '/api/patient/reminders/routine-opt-in',
    apiLimiter,
    requirePatientSession,
    (req, res) => {
      try {
        const { patientId } = owner(req);
        return res.json({
          success: true,
          routine_reminder_opt_in: hasRoutineReminderOptIn(db.db, { patientId }),
        });
      } catch (e) {
        return fail(res, e);
      }
    },
  );
}

module.exports = { registerPatientMedicalProgressRoutes };
