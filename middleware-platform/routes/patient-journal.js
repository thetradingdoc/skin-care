'use strict';

function registerPatientJournalRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    parseBillingDocumentUpload,
    ensureJournalTables,
    isIsoDateOnly,
  } = deps;

  function clientTodayIso(req) {
    const { resolveClientTodayIso } = require('../lib/routine-day-mode');
    return resolveClientTodayIso(req);
  }

  function journalStandaloneEnabled() {
    return String(process.env.JOURNAL_MODE_STANDALONE || '0').trim() === '1';
  }

  function triggerInsightsEnabled() {
    return String(process.env.TRIGGER_INSIGHTS_ENABLED || '0').trim() === '1';
  }

  function improvementsEnabled() {
    return String(process.env.IMPROVEMENTS_API_ENABLED || '0').trim() === '1';
  }

  function journalDisabled(res) {
    return res.status(503).json({
      success: false,
      error_code: 'JOURNAL_MODE_DISABLED',
      error: 'Standalone journal mode is not enabled.',
    });
  }

  function entryToApi(entry, photoUrl) {
    if (!entry) return null;
    const { primaryConditionLabel } = require('../lib/journal-condition-tags');
    return {
      entry_id: entry.id,
      entry_date: entry.entry_date,
      photo_url: photoUrl || entry.photo_storage_ref || null,
      condition_tags: entry.condition_tags || [],
      primary_condition: primaryConditionLabel(entry.condition_tags),
      note: entry.note || null,
      has_photo: Boolean(entry.photo_storage_ref),
      source: entry.source,
    };
  }

  app.post(
    '/api/patient/journal/daily-photo',
    (req, res, next) => apiLimiter(req, res, next),
    parseBillingDocumentUpload,
    requirePatientSession,
    async (req, res) => {
      if (!journalStandaloneEnabled()) return journalDisabled(res);
      try {
        ensureJournalTables(db.db);
        const uploadFile = req.file || (Array.isArray(req.files) ? req.files[0] : null);
        if (!uploadFile || !uploadFile.buffer) {
          return res.status(400).json({
            success: false,
            error_code: 'FILE_REQUIRED',
            error: 'Photo file is required.',
          });
        }

        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const entryDateRaw = String(req.body?.entry_date || req.body?.date || '').trim();
        const entryDate = isIsoDateOnly(entryDateRaw) ? entryDateRaw : clientTodayIso(req);

        const { resolveRoutineDayMode } = require('../lib/routine-day-mode');
        const dayMode = resolveRoutineDayMode(entryDate, clientTodayIso(req));
        if (!dayMode.allows_photo) {
          return res.status(403).json({
            success: false,
            error_code: 'HISTORICAL_READ_ONLY',
            error: 'This day is read-only. Progress photos can only be added within the last 48 hours.',
            day_mode: dayMode.mode,
          });
        }

        const { normalizeConditionTags } = require('../lib/journal-condition-tags');
        let conditionTags = [];
        try {
          const raw = req.body?.condition_tags ?? req.body?.symptom_tags;
          if (raw) {
            conditionTags = normalizeConditionTags(typeof raw === 'string' ? JSON.parse(raw) : raw);
          }
        } catch (_) {}

        const note = req.body?.note != null ? String(req.body.note) : undefined;

        const gcsBillingStorage = require('../services/gcs-billing-storage');
        const uploaded = await gcsBillingStorage.uploadBuffer({
          buffer: uploadFile.buffer,
          contentType: uploadFile.mimetype || 'image/jpeg',
          patientId: patientId || sessionId || 'session',
          fileName: uploadFile.originalname || `journal-${entryDate}.jpg`,
        });

        const { upsertEntry } = require('../repositories/patient-journal-repo');
        const entry = upsertEntry(db.db, {
          patientId,
          sessionId,
          entryDate,
          photoStorageRef: uploaded.storageRef,
          conditionTags,
          note,
          source: 'standalone',
        });

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'journal_photo_uploaded', {
            entry_date: entryDate,
            entry_id: entry.id,
          });
        }

        return res.json({
          success: true,
          ...entryToApi(entry, uploaded.storageRef),
          day_mode: dayMode.mode,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error_code: 'JOURNAL_PHOTO_FAILED', error: e.message });
      }
    },
  );

  app.patch(
    '/api/patient/journal/daily-entry',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    async (req, res) => {
      if (!journalStandaloneEnabled()) return journalDisabled(res);
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const entryDateRaw = String(body.entry_date || body.date || '').trim();
        const entryDate = isIsoDateOnly(entryDateRaw) ? entryDateRaw : clientTodayIso(req);

        const { resolveRoutineDayMode } = require('../lib/routine-day-mode');
        const dayMode = resolveRoutineDayMode(entryDate, clientTodayIso(req));
        if (!dayMode.is_mutable) {
          return res.status(403).json({
            success: false,
            error_code: 'HISTORICAL_READ_ONLY',
            error: 'This day is read-only.',
            day_mode: dayMode.mode,
          });
        }

        const { normalizeConditionTags } = require('../lib/journal-condition-tags');
        const conditionTags =
          body.condition_tags != null ? normalizeConditionTags(body.condition_tags) : undefined;
        const note = body.note !== undefined ? body.note : undefined;

        const { upsertEntry } = require('../repositories/patient-journal-repo');
        const entry = upsertEntry(db.db, {
          patientId,
          sessionId,
          entryDate,
          conditionTags: conditionTags ?? [],
          note,
          source: 'standalone',
        });

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'journal_checkin_saved', { entry_date: entryDate });
        }

        return res.json({
          success: true,
          ...entryToApi(entry),
          day_mode: dayMode.mode,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error_code: 'JOURNAL_CHECKIN_FAILED', error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/journal/timeline',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const days = Math.max(1, Math.min(60, Number(req.query?.days) || 8));
        const todayIso = clientTodayIso(req);
        const start = new Date(`${todayIso}T12:00:00.000Z`);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const startIso = start.toISOString().slice(0, 10);

        const { getByDateRange } = require('../repositories/patient-journal-repo');
        const { mergeJournalTimeline } = require('../lib/journal-timeline-merge');
        const journalEntries = getByDateRange(db.db, { patientId, sessionId, startIso, endIso: todayIso });

        const timeline = mergeJournalTimeline({
          journalEntries: journalEntries.map((e) => ({
            entry_date: e.entry_date,
            photo_storage_ref: e.photo_storage_ref,
            condition_tags: e.condition_tags,
            note: e.note,
            source: e.source,
          })),
          routineDays: [],
          issuePhotoUrl: (ref) => ref,
        });

        return res.json({
          success: true,
          days: timeline.slice(-days).reverse(),
        });
      } catch (e) {
        return res.status(500).json({ success: false, error_code: 'TIMELINE_FAILED', error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/journal/trigger-insights',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      if (!triggerInsightsEnabled()) {
        return res.json({ success: true, ready: false, insights: [], feature_enabled: false });
      }
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const { listRecentEntries } = require('../repositories/patient-journal-repo');
        const { computeTriggerInsights } = require('../services/journal-trigger-insights');
        const entries = listRecentEntries(db.db, { patientId, sessionId, limit: 60 });
        const result = computeTriggerInsights(entries);
        return res.json({ success: true, feature_enabled: true, ...result });
      } catch (e) {
        return res.status(500).json({ success: false, error_code: 'TRIGGER_INSIGHTS_FAILED', error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/journal/improvements',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    async (req, res) => {
      if (!improvementsEnabled()) {
        return res.json({ success: true, ready: false, feature_enabled: false, metrics: null });
      }
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const todayIso = clientTodayIso(req);
        const { listRecentEntries } = require('../repositories/patient-journal-repo');
        const { computeJournalImprovements } = require('../services/journal-improvements');
        const entries = listRecentEntries(db.db, { patientId, sessionId, limit: 60 });
        const result = computeJournalImprovements(entries, todayIso);
        return res.json({ success: true, feature_enabled: true, ...result });
      } catch (e) {
        return res.status(500).json({ success: false, error_code: 'IMPROVEMENTS_FAILED', error: e.message });
      }
    },
  );
}

module.exports = {
  registerPatientJournalRoutes,
};
