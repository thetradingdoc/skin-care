'use strict';

// PR1 soft-launch safety — 2026-07-12

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
    // Phase 2 Check home — camera journal is the product. Default ON.
    // Opt out: JOURNAL_MODE_STANDALONE=0
    const raw = process.env.JOURNAL_MODE_STANDALONE;
    if (raw == null || String(raw).trim() === '') return true;
    return String(raw).trim() === '1';
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
    const { issueReadUrl } = require('../services/gcs-billing-storage');
    const resolvedPhoto =
      photoUrl ||
      (entry.photo_storage_ref ? issueReadUrl(entry.photo_storage_ref) : null) ||
      null;
    return {
      entry_id: entry.id,
      entry_date: entry.entry_date,
      photo_url: resolvedPhoto,
      condition_tags: entry.condition_tags || [],
      primary_condition: primaryConditionLabel(entry.condition_tags),
      note: entry.note || null,
      has_photo: Boolean(entry.photo_storage_ref),
      source: entry.source,
      dryness_level: entry.dryness_level || null,
      breakout_level: entry.breakout_level || null,
      calm_flag: entry.calm_flag || null,
      dryness_rank: entry.dryness_rank ?? null,
      breakout_rank: entry.breakout_rank ?? null,
      dryness_score: entry.dryness_score ?? null,
      breakout_score: entry.breakout_score ?? null,
      advanced_severity: Boolean(entry.advanced_severity),
    };
  }

  function parseSeverityFromBody(body, rawMultipart) {
    const { normalizeSeverityPayload } = require('../lib/journal-severity');
    let payload = body && typeof body === 'object' ? { ...body } : {};
    if (rawMultipart) {
      try {
        if (typeof body.severity === 'string') Object.assign(payload, JSON.parse(body.severity));
      } catch (_) {}
    }
    return normalizeSeverityPayload(payload);
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
        const sev = parseSeverityFromBody(req.body, true);

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
          source: String(req.body?.source || 'check_camera'),
          drynessLevel: sev.dryness_level,
          breakoutLevel: sev.breakout_level,
          calmFlag: sev.calm_flag,
          drynessScore: sev.dryness_score,
          breakoutScore: sev.breakout_score,
          advancedSeverity: Boolean(sev.advanced_severity),
        });

        // P2.12 — best-effort dual-write → patient_record_facts (tag=skin); journal write already committed
        try {
          const { dualWriteJournalSkin } = require('../services/patient-record-dual-write');
          dualWriteJournalSkin(db.db, {
            patientId,
            sessionId,
            entry,
            media: {
              storage_ref: uploaded.storageRef,
              storage_key: uploaded.storageKey || null,
              storage_provider: uploaded.provider || null,
            },
          });
        } catch (_) {}

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'journal_photo_uploaded', {
            entry_date: entryDate,
            entry_id: entry.id,
          });
        }

        return res.json({
          success: true,
          ...entryToApi(entry, require('../services/gcs-billing-storage').issueReadUrl(uploaded.storageRef)),
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
        const sev = parseSeverityFromBody(body, false);
        const hasSev =
          sev.dryness_level != null ||
          sev.breakout_level != null ||
          sev.calm_flag != null ||
          sev.dryness_score != null ||
          sev.breakout_score != null;

        const { upsertEntry } = require('../repositories/patient-journal-repo');
        const entry = upsertEntry(db.db, {
          patientId,
          sessionId,
          entryDate,
          conditionTags: conditionTags ?? [],
          note,
          source: String(body.source || 'check_camera'),
          ...(hasSev
            ? {
                drynessLevel: sev.dryness_level,
                breakoutLevel: sev.breakout_level,
                calmFlag: sev.calm_flag,
                drynessScore: sev.dryness_score,
                breakoutScore: sev.breakout_score,
                advancedSeverity: Boolean(sev.advanced_severity),
              }
            : {}),
        });

        // P2.12 — best-effort dual-write → patient_record_facts (tag=skin); journal write already committed
        try {
          const { dualWriteJournalSkin } = require('../services/patient-record-dual-write');
          dualWriteJournalSkin(db.db, { patientId, sessionId, entry });
        } catch (_) {}

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
            dryness_level: e.dryness_level,
            breakout_level: e.breakout_level,
            calm_flag: e.calm_flag,
            dryness_rank: e.dryness_rank,
            breakout_rank: e.breakout_rank,
          })),
          routineDays: [],
          issuePhotoUrl: (ref) => require('../services/gcs-billing-storage').issueReadUrl(ref) || null,
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

  /** TOUCH-041 — yesterday severity for prefill */
  app.get(
    '/api/patient/journal/severity/yesterday',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const todayIso = clientTodayIso(req);
        const { getYesterdaySeverity } = require('../repositories/patient-journal-repo');
        const entry = getYesterdaySeverity(db.db, { patientId, sessionId, todayIso });
        return res.json({
          success: true,
          entry_date: entry?.entry_date || null,
          severity: entry
            ? {
                dryness_level: entry.dryness_level,
                breakout_level: entry.breakout_level,
                calm_flag: entry.calm_flag,
                dryness_score: entry.dryness_score,
                breakout_score: entry.breakout_score,
                advanced_severity: entry.advanced_severity,
              }
            : null,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /** TOUCH-042/048 — severity history ranks for charts */
  app.get(
    '/api/patient/journal/severity/history',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        ensureJournalTables(db.db);
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const days = Math.max(1, Math.min(60, Number(req.query?.days) || 14));
        const todayIso = clientTodayIso(req);
        const start = new Date(`${todayIso}T12:00:00.000Z`);
        start.setUTCDate(start.getUTCDate() - (days - 1));
        const startIso = start.toISOString().slice(0, 10);
        const { getByDateRange } = require('../repositories/patient-journal-repo');
        const entries = getByDateRange(db.db, { patientId, sessionId, startIso, endIso: todayIso });
        return res.json({
          success: true,
          days: entries.map((e) => ({
            date: e.entry_date,
            dryness_level: e.dryness_level,
            breakout_level: e.breakout_level,
            calm_flag: e.calm_flag,
            dryness_rank: e.dryness_rank,
            breakout_rank: e.breakout_rank,
            dryness_score: e.dryness_score,
            breakout_score: e.breakout_score,
          })),
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /** TOUCH-043 — agent delta banner payload for Check */
  app.get(
    '/api/patient/check/agent-delta',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const { findBarrierDip } = require('../services/barrier-insight-service');
        const dip = findBarrierDip(db.db, { sessionId, patientId, days: 14 });

        // P5.02 — N-day-worse + co-occurrence from patient_record_facts (not journal severity table)
        let factsDelta = null;
        try {
          const { computeFactsAgentDelta } = require('../services/medical-tracker-domain/agent-delta-facts');
          factsDelta = computeFactsAgentDelta(db.db, {
            patientId,
            sessionId,
            todayIso: clientTodayIso(req),
          });
        } catch (e) {
          if (e.code === 'OWNER_REQUIRED' || e.code === 'TODAY_ISO_REQUIRED') throw e;
          factsDelta = { show: false, error_code: e.code || 'FACTS_DELTA_FAILED' };
        }

        const show = Boolean(dip || factsDelta?.show);
        const message = factsDelta?.message || dip?.message || null;
        if (show && message) {
          try {
            const { maybeEnqueueAgentDeltaPush } = require('../services/patient-push-service');
            maybeEnqueueAgentDeltaPush(db.db, { patientId, sessionId, message });
          } catch (_) {}
        }
        return res.json({
          success: true,
          show,
          barrier_dip: dip || null,
          // Legacy journal severity_delta removed from primary path — facts store is SSOT
          severity_delta: null,
          facts_agent_delta: factsDelta,
          n_day_worse: factsDelta?.n_day_worse || null,
          product_cooccurrence: factsDelta?.product_cooccurrence || null,
          message,
          skip_action: show ? 'skip_active_tonight' : null,
          source: factsDelta?.source || (dip ? 'barrier_dip' : null),
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/check/agent-delta/skip',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const entryDate = clientTodayIso(req);
        const { applySkipActivesTonight } = require('../services/check-agent-skip-service');
        const result = applySkipActivesTonight(db.db, { sessionId, patientId, entryDate });

        // TOUCH-044 — maps to existing routine daily item-log skip path (not a new chat).
        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'check_agent_skip', {
            action: 'skip_active_tonight',
            daily_entry_id: result.daily_entry_id || null,
            skipped_count: result.skipped_count,
            path: result.path || result.reason || null,
          });
        }
        return res.json({
          success: true,
          applied: 'skip_active_tonight',
          advice: result.advice,
          daily_entry_id: result.daily_entry_id || null,
          skipped_count: result.skipped_count,
          path: result.path || result.reason || null,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.post(
    '/api/patient/check/agent-delta/keep',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        // TOUCH-045 — dismiss only; routine unchanged.
        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'check_agent_keep', {});
        }
        return res.json({ success: true, dismissed: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
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
