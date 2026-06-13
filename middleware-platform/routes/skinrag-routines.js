'use strict';

const skinragRoutineService = require('../services/skinrag-routine-service');

function registerSkinragRoutineRoutes(app, { apiLimiter }) {
  app.get('/api/skinrag/routine/:concern', apiLimiter, (req, res) => {
    try {
      const concernId = String(req.params?.concern || '').trim();
      const routine = skinragRoutineService.getRoutineForConcern(concernId);
      if (!routine) {
        return res.status(404).json({ success: false, error: 'unknown_concern' });
      }
      return res.json({
        success: true,
        feature_skinrag: skinragRoutineService.isSkinragEnabled(),
        routine,
      });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });
}

module.exports = { registerSkinragRoutineRoutes };
