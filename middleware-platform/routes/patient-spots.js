'use strict';

const spotRepo = require('../repositories/spot-repo');
const { analyzeNewSnapshot } = require('../services/spot-snapshot-service');

function registerPatientSpotsRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    parseBillingDocumentUpload,
    recordPatientPortalEvent,
  } = deps;

  app.get(
    '/api/patient/spots',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const spots = await spotRepo.listSpots(db.db, { patientId, sessionId });
        return res.json({ success: true, spots });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/spots',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const spot = await spotRepo.createSpot(db.db, {
          patientId,
          sessionId,
          label: body.label,
          bodyRegion: body.body_region || body.bodyRegion,
        });
        return res.json({ success: true, spot });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/spots/migrate',
    (req, res, next) => apiLimiter(req, res, next),
    express.json({ limit: '2mb' }),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const spots = body.spots || body.items || [];
        const imported = await spotRepo.migrateSpots(db.db, { patientId, sessionId, spots });
        return res.json({ success: true, imported_count: imported.length, spot_ids: imported });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/spots/:id',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const spot = await spotRepo.getSpot(db.db, {
          patientId,
          sessionId,
          spotId: String(req.params.id || '').trim(),
        });
        if (!spot) return res.status(404).json({ success: false, error: 'Spot not found' });
        return res.json({ success: true, spot });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/spots/:id/timeline',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const timeline = await spotRepo.getSpotTimeline(db.db, {
          patientId,
          sessionId,
          spotId: String(req.params.id || '').trim(),
        });
        if (!timeline) return res.status(404).json({ success: false, error: 'Spot not found' });
        return res.json({ success: true, timeline });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/spots/:id/snapshots',
    (req, res, next) => apiLimiter(req, res, next),
    parseBillingDocumentUpload,
    requirePatientSession,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const spotId = String(req.params.id || '').trim();
        const spot = await spotRepo.getSpot(db.db, { patientId, sessionId, spotId });
        if (!spot) return res.status(404).json({ success: false, error: 'Spot not found' });

        const uploadFile = req.file || (Array.isArray(req.files) ? req.files[0] : null);
        let storageRef = null;
        let thumbStorageRef = null;

        if (uploadFile?.buffer) {
          const gcsBillingStorage = require('../services/gcs-billing-storage');
          const uploaded = await gcsBillingStorage.uploadBuffer({
            buffer: uploadFile.buffer,
            contentType: uploadFile.mimetype || 'image/jpeg',
            patientId: patientId || sessionId || 'session',
            fileName: uploadFile.originalname || `spot-${spotId}.jpg`,
          });
          storageRef = uploaded.storageRef;
          thumbStorageRef = uploaded.storageRef;
        } else if (req.body?.storage_ref) {
          storageRef = String(req.body.storage_ref).trim();
          thumbStorageRef = storageRef;
        } else {
          return res.status(400).json({ success: false, error: 'Photo file or storage_ref required' });
        }

        const prior = spot.photos || [];
        const analysis = analyzeNewSnapshot(prior);
        const journalEntryId = req.body?.journal_entry_id || req.body?.journalEntryId || null;

        const snapshot = await spotRepo.addSnapshot(db.db, {
          spotId,
          storageRef,
          thumbStorageRef,
          journalEntryId,
          analysis,
        });

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'spot_snapshot_created', {
            spot_id: spotId,
            change_tag: analysis.change_tag,
          });
        }

        return res.json({
          success: true,
          snapshot,
          analysis,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientSpotsRoutes };
