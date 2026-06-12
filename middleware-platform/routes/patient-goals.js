'use strict';

const {
  listGoals,
  createGoal,
  updateGoal,
  VALID_TYPES,
} = require('../repositories/patient-goals-repo');
const { getNextActions } = require('../services/consumer-journey-agent');

function registerPatientGoalsRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    loadPatientShelfProductRows,
  } = deps;

  app.get(
    '/api/patient/goals',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const status = req.query?.status ? String(req.query.status) : undefined;
        const goals = await listGoals(db.db, { sessionId, patientId, status });
        return res.json({ success: true, goals });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/goals',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const goalType = body.goal_type || body.goalType;
        if (!VALID_TYPES.has(String(goalType))) {
          return res.status(400).json({ success: false, error: 'invalid_goal_type' });
        }
        const goal = await createGoal(db.db, {
          patientId,
          sessionId,
          goalType,
          targetRef: body.target_ref || body.targetRef || null,
          source: body.source || 'user',
        });
        return res.json({ success: true, goal });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.patch(
    '/api/patient/goals/:id',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const goal = await updateGoal(db.db, {
          patientId,
          sessionId,
          goalId: String(req.params.id || ''),
          patch: body,
        });
        if (!goal) return res.status(404).json({ success: false, error: 'goal_not_found' });
        return res.json({ success: true, goal });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/home/next-actions',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const result = await getNextActions(db.db, {
          sessionId,
          patientId,
          loadShelfRows: (sid) => loadPatientShelfProductRows(sid),
        });
        return res.json({ success: true, ...result });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientGoalsRoutes };
