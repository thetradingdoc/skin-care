'use strict';

/**
 * P2.10 / P2.15–P2.18 / P2.20–29 / P3 capture routes.
 */

const multer = require('multer');
const {
  requireRecordTag,
  requireRecordMediaType,
} = require('../middleware/patient-record-facts');
const {
  AI_OR_MANUAL,
  validateTagStructured,
  parseStructuredJsonInput,
  RECORD_TAGS,
} = require('../services/patient-record-fact-validators');
const { persistRecordMedia } = require('../services/patient-record-media');
const { detectLanguageStub } = require('../services/patient-record-language-stub');
const {
  presentFact,
  consumeMediaToken,
} = require('../services/patient-record-media-access');
const { resolveOwnerKey } = require('../services/ai-capture-meter');
const factsRepo = require('../repositories/patient-record-facts-repo');
const BlobStorage = require('../services/blob-storage');
const {
  createOrGetPending,
  attachFactId,
  getPendingByToken,
  purgeExpiredPendingCaptures,
} = require('../services/pending-capture-claim');
const {
  orchestrateCapture,
  orchestrateMultiCapture,
  maybeAddRxToShelf,
} = require('../services/capture-orchestration');
const {
  getCaptureSession,
  advanceCaptureQueue,
  orderTagsForCapture,
} = require('../services/capture-orchestration/capture-session');
const { prepareConfirmStructuredForPersist, assertOrchestrationPersistPolicy } = require('../services/medical-tracker-rails/policy');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Number(process.env.PATIENT_UPLOAD_MAX_MB || 10)) * 1024 * 1024 },
});

/**
 * SEC-26/27 — Fact or capture-session must belong to this patient session.
 * Match patient_id when both set; else match session_id. Fail closed if neither matches.
 */
function assertRecordOwnedByCaller(row, { patientId, sessionId }) {
  if (!row) return { ok: false, status: 404, error: 'NOT_FOUND' };
  const rowPatient = row.patient_id != null ? String(row.patient_id) : null;
  const rowSession = row.session_id != null ? String(row.session_id) : null;
  const callerPatient = patientId != null ? String(patientId) : null;
  const callerSession = sessionId != null ? String(sessionId) : null;

  if (rowPatient && callerPatient && rowPatient === callerPatient) return { ok: true };
  if (rowSession && callerSession && rowSession === callerSession) return { ok: true };
  if (rowPatient && callerPatient && rowPatient !== callerPatient) {
    return { ok: false, status: 403, error: 'FORBIDDEN', code: 'RECORD_IDOR' };
  }
  if (rowSession && callerSession && rowSession !== callerSession) {
    return { ok: false, status: 403, error: 'FORBIDDEN', code: 'RECORD_IDOR' };
  }
  // Bound to someone else with no matching identity
  if (rowPatient || rowSession) {
    return { ok: false, status: 403, error: 'FORBIDDEN', code: 'RECORD_IDOR' };
  }
  return { ok: false, status: 403, error: 'FORBIDDEN', code: 'RECORD_IDOR' };
}

function registerPatientRecordRoutes(app, deps) {
  const {
    apiLimiter,
    express,
    db,
    requirePatientSession,
    resolvePatientIdFromSession,
    recordPatientPortalEvent,
    botGuard,
    resolveBillingSubscription,
  } = deps;

  const maybeBotGuard = typeof botGuard === 'function' ? botGuard : (_req, _res, next) => next();

  function resolveIsPlus(req) {
    try {
      if (typeof resolveBillingSubscription === 'function') {
        return resolveBillingSubscription(req)?.tier === 'plus';
      }
    } catch (_) {}
    return false;
  }

  /**
   * POST /api/patient/records/upload
   */
  app.post(
    '/api/patient/records/upload',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data')) {
        return upload.single('file')(req, res, next);
      }
      return express.json()(req, res, next);
    },
    requireRecordTag,
    requireRecordMediaType,
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const tag = req.recordTag;
        const mediaType = req.recordMediaType;

        const aiOrManual = String(req.body?.ai_or_manual || '').trim().toLowerCase();
        if (!AI_OR_MANUAL.includes(aiOrManual)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_AI_OR_MANUAL',
            error_code: 'INVALID_AI_OR_MANUAL',
            message: `ai_or_manual must be one of: ${AI_OR_MANUAL.join(', ')}`,
            allowed: AI_OR_MANUAL,
          });
        }

        const structuredRaw = parseStructuredJsonInput(req.body?.structured_json);
        if (structuredRaw.__parse_error) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_STRUCTURED_JSON',
            error_code: 'INVALID_STRUCTURED_JSON',
            message: 'structured_json must be valid JSON',
          });
        }

        // P2.17–18: stub language detect when lab/other + OCR text present
        let rawExtract = req.body?.raw_extract_text != null ? String(req.body.raw_extract_text) : null;
        if ((tag === 'lab' || tag === 'other') && rawExtract) {
          const detected = detectLanguageStub(rawExtract);
          if (!structuredRaw.source_language && detected.source_language) {
            structuredRaw.source_language = detected.source_language;
          }
          if (!structuredRaw.display_language) {
            structuredRaw.display_language = structuredRaw.source_language || 'en';
          }
        }

        const validated = validateTagStructured(tag, structuredRaw);
        if (!validated.valid) {
          return res.status(400).json({
            success: false,
            error: 'STRUCTURED_VALIDATION_FAILED',
            error_code: 'STRUCTURED_VALIDATION_FAILED',
            errors: validated.errors,
          });
        }

        const requestId = req.body?.request_id ? String(req.body.request_id).trim() : null;
        if (requestId) {
          const existing = factsRepo.getFactByRequestId(db.db, {
            patientId,
            sessionId,
            requestId,
          });
          if (existing) {
            return res.status(200).json({
              success: true,
              fact: presentFact(existing, { db: db.db }),
              idempotent_replay: true,
            });
          }
        }

        const file = req.file || null;
        let storage = { storage_ref: null, storage_provider: null, storage_key: null };
        if (file?.buffer) {
          if (!mediaType) {
            return res.status(400).json({
              success: false,
              error: 'MEDIA_TYPE_REQUIRED',
              error_code: 'MEDIA_TYPE_REQUIRED',
              message: 'media_type photo|pdf required when uploading a file',
            });
          }

          // SEC-28: same AV + media gate as orchestrated /capture (do not reopen weaker path)
          const { assertMedicalUploadAllowed } = require('../services/patient-record-media-gate');
          const mediaReject = assertMedicalUploadAllowed({
            buffer: file.buffer,
            mimeType: file.mimetype,
            fileName: file.originalname,
          });
          if (mediaReject) {
            return res.status(mediaReject.status || 400).json({
              success: false,
              error: mediaReject.error_code || 'MEDIA_REJECTED',
              error_code: mediaReject.error_code || 'MEDIA_REJECTED',
              message: mediaReject.message || 'Upload rejected',
            });
          }
          const AntivirusService = require('../services/antivirus-service');
          const avResult = await AntivirusService.scanPatientRecordBuffer(file.buffer);
          if (!avResult.safe) {
            return res.status(403).json({
              success: false,
              error: avResult.error_code || 'AV_SCAN_BLOCKED',
              error_code: avResult.error_code || 'AV_SCAN_BLOCKED',
              message: avResult.error || AntivirusService.BLOCKED_MESSAGE,
              manual_allowed: false,
            });
          }

          storage = await persistRecordMedia({
            buffer: file.buffer,
            contentType: file.mimetype,
            patientId: patientId || null,
            sessionId,
            fileName: file.originalname,
            mediaType,
          });
        }

        // SEC-28: persist policy (same family as orchestrate) — do not skip for legacy upload
        const trustedProvenance =
          validated.normalized?.field_provenance && typeof validated.normalized.field_provenance === 'object'
            ? validated.normalized.field_provenance
            : null;
        const policy = assertOrchestrationPersistPolicy(tag, validated.normalized, { trustedProvenance });
        if (!policy.ok) {
          return res.status(policy.status || 400).json({
            success: false,
            error: policy.error_code || policy.error || 'PERSIST_POLICY_REJECTED',
            error_code: policy.error_code || policy.error || 'PERSIST_POLICY_REJECTED',
            message: policy.message || 'Persist policy rejected',
            details: policy.details || undefined,
          });
        }

        const fact = factsRepo.insertFact(db.db, {
          patient_id: patientId || null,
          session_id: sessionId,
          tag,
          media_type: mediaType,
          ai_or_manual: aiOrManual,
          storage_ref: storage.storage_ref,
          storage_provider: storage.storage_provider,
          storage_key: storage.storage_key,
          structured_json: validated.normalized,
          raw_extract_text: rawExtract,
          source_language:
            validated.normalized?.source_language || structuredRaw.source_language || null,
          display_language:
            validated.normalized?.display_language || structuredRaw.display_language || null,
          compare_group_id: validated.normalized?.compare_group_id || null,
          request_id: requestId,
          confirmed_at: null,
        });

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'patient_record_uploaded', {
            fact_id: fact.id,
            tag,
            media_type: mediaType,
            ai_or_manual: aiOrManual,
          });
        }

        return res.status(201).json({ success: true, fact: presentFact(fact, { db: db.db }) });
      } catch (e) {
        if (String(e?.message || '').includes('UNIQUE') || e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({
            success: false,
            error: 'REQUEST_ID_CONFLICT',
            error_code: 'REQUEST_ID_CONFLICT',
            message: 'request_id already used for this owner',
          });
        }
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * Field templates SSOT — used by confirm + manual entry UIs.
   * GET /api/patient/records/field-templates?tag=
   */
  app.get(
    '/api/patient/records/field-templates',
    (req, res, next) => apiLimiter(req, res, next),
    (req, res) => {
      try {
        const { listTemplates, getTemplate } = require('../services/record-field-templates');
        const tag = req.query?.tag ? String(req.query.tag).trim().toLowerCase() : null;
        const id = req.query?.id ? String(req.query.id).trim() : null;
        if (id) {
          const t = getTemplate(id);
          if (!t) return res.status(404).json({ success: false, error: 'TEMPLATE_NOT_FOUND' });
          return res.json({ success: true, template: t });
        }
        return res.json({ success: true, templates: listTemplates({ tag }) });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.16 — GET /api/patient/records?tag=&start=&end=&limit=
   */
  app.get(
    '/api/patient/records',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const tag = req.query?.tag ? String(req.query.tag).trim().toLowerCase() : null;
        const startIso = req.query?.start || req.query?.from || null;
        const endIso = req.query?.end || req.query?.to || null;
        const limit = req.query?.limit;
        const facts = factsRepo.listFacts(db.db, {
          patientId,
          sessionId,
          tag,
          startIso: startIso ? String(startIso).slice(0, 10) : null,
          endIso: endIso ? String(endIso).slice(0, 10) : null,
          limit,
        });
        return res.json({
          success: true,
          facts: facts.map((f) => presentFact(f, { db: db.db })),
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.15 — GET /api/patient/records/:id
   * Reserved path segments (calendar, media, anonymous, capture, …) must be
   * registered BEFORE this param route — see register-patient-routes.js order.
   */
  app.get(
    '/api/patient/records/:id',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        const id = String(req.params.id || '').trim();
        const RESERVED = new Set([
          'calendar',
          'media',
          'anonymous',
          'capture',
          'capture-sessions',
          'upload',
        ]);
        if (RESERVED.has(id)) {
          return res.status(404).json({
            success: false,
            error: 'NOT_FOUND',
            error_code: 'RESERVED_RECORDS_PATH',
            message: 'Route registration order bug: static path shadowed by :id',
          });
        }
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const fact = factsRepo.getFactById(db.db, id);
        if (!fact) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        const ownerKey = resolveOwnerKey({ patientId, sessionId });
        const owns =
          (fact.owner_key && ownerKey && fact.owner_key === ownerKey) ||
          (patientId && fact.patient_id === patientId) ||
          (sessionId && fact.session_id === sessionId);
        if (!owns) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        return res.json({ success: true, fact: presentFact(fact, { db: db.db }) });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.15 / P2.18 — PATCH /api/patient/records/:id/confirm
   * Body: { structured_json?, source_language?, display_language?, raw_extract_text?, compare_group_id? }
   */
  app.patch(
    '/api/patient/records/:id/confirm',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const id = String(req.params.id || '').trim();
        const existing = factsRepo.getFactById(db.db, id);
        if (!existing) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

        const ownerKey = resolveOwnerKey({ patientId, sessionId });
        const owns =
          (existing.owner_key && ownerKey && existing.owner_key === ownerKey) ||
          (patientId && existing.patient_id === patientId) ||
          (sessionId && existing.session_id === sessionId);
        if (!owns) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        let structuredRaw =
          body.structured_json != null
            ? parseStructuredJsonInput(body.structured_json)
            : { ...existing.structured_json };
        if (structuredRaw.__parse_error) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_STRUCTURED_JSON',
            error_code: 'INVALID_STRUCTURED_JSON',
          });
        }

        let rawExtract =
          body.raw_extract_text != null ? String(body.raw_extract_text) : existing.raw_extract_text;

        // P2.18 — stub detect editable on confirm
        if (rawExtract && (existing.tag === 'lab' || existing.tag === 'other')) {
          const detected = detectLanguageStub(rawExtract);
          if (body.source_language == null && !structuredRaw.source_language && detected.source_language) {
            structuredRaw.source_language = detected.source_language;
          }
        }
        if (body.source_language != null) structuredRaw.source_language = String(body.source_language);
        if (body.display_language != null) structuredRaw.display_language = String(body.display_language);
        if (!structuredRaw.display_language && structuredRaw.source_language) {
          structuredRaw.display_language = structuredRaw.source_language;
        }

        const validated = validateTagStructured(existing.tag, structuredRaw);
        if (!validated.valid) {
          return res.status(400).json({
            success: false,
            error: 'STRUCTURED_VALIDATION_FAILED',
            error_code: 'STRUCTURED_VALIDATION_FAILED',
            errors: validated.errors,
          });
        }

        const prepared = prepareConfirmStructuredForPersist(existing, validated.normalized);
        if (!prepared.ok) {
          const p = prepared.policy || {};
          return res.status(400).json({
            success: false,
            error: p.error_code || 'DIAGNOSIS_VOCABULARY',
            error_code: p.error_code || 'DIAGNOSIS_VOCABULARY',
            message: p.message || 'Diagnosis vocabulary rejected',
            matches: p.matches,
            action: p.action || 'retake',
            vision_fail: true,
            manual_allowed: true,
          });
        }

        const updated = factsRepo.updateFactConfirm(db.db, {
          id,
          patientId,
          sessionId,
          patch: {
            structured_json: prepared.structured,
            source_language: prepared.structured?.source_language || body.source_language || null,
            display_language: prepared.structured?.display_language || body.display_language || null,
            compare_group_id: body.compare_group_id != null ? body.compare_group_id : null,
            raw_extract_text: rawExtract,
            confirmed_at: new Date().toISOString(),
          },
        });

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'patient_record_confirmed', { fact_id: id, tag: existing.tag });
        }

        return res.json({ success: true, fact: presentFact(updated, { db: db.db }) });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * Capture gate — AV + quality only (unmetered). Loading "reading" phase.
   * No session required so Track + cold onboarding share the same first step.
   */
  app.post(
    '/api/patient/records/capture/gate',
    maybeBotGuard,
    (req, res, next) => apiLimiter(req, res, next),
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data')) {
        return upload.single('file')(req, res, next);
      }
      return express.json({ limit: '2mb' })(req, res, next);
    },
    async (req, res) => {
      try {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        let tag = String(body.tag || '').trim().toLowerCase();
        if (tag === 'rx') tag = 'prescription';
        const file = req.file || null;
        const buffer =
          file?.buffer ||
          (body.file_base64
            ? Buffer.from(String(body.file_base64).replace(/^data:[^;]+;base64,/, ''), 'base64')
            : null);
        const mimeType = file?.mimetype || body.mime_type || null;

        if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
          return res.status(422).json({
            success: false,
            error: 'QUALITY_GATE_FAILED',
            error_code: 'QUALITY_GATE_FAILED',
            action: 'retake',
            manual_allowed: true,
            message: 'No image or document bytes received.',
          });
        }

        const fileName = file?.originalname || body.file_name || null;
        const { assertMedicalUploadAllowed } = require('../services/patient-record-media-gate');
        const mediaReject = assertMedicalUploadAllowed({
          buffer,
          mimeType,
          fileName,
        });
        if (mediaReject) {
          return res.status(mediaReject.status || 400).json({
            success: false,
            error: mediaReject.error_code,
            error_code: mediaReject.error_code,
            message: mediaReject.message,
            manual_allowed: mediaReject.manual_allowed !== false,
            allowed: mediaReject.allowed,
          });
        }

        const AntivirusService = require('../services/antivirus-service');
        const avResult = await AntivirusService.scanPatientRecordBuffer(buffer);
        if (!avResult.safe) {
          return res.status(403).json({
            success: false,
            error: avResult.error_code || 'AV_SCAN_BLOCKED',
            error_code: avResult.error_code || 'AV_SCAN_BLOCKED',
            message: avResult.error || AntivirusService.BLOCKED_MESSAGE,
            manual_allowed: false,
          });
        }

        const { assessCaptureQuality } = require('../services/capture-orchestration/quality-gate');
        const quality = assessCaptureQuality({
          buffer,
          mimeType,
          tag: tag || null,
          meta: body.quality_meta || null,
        });
        if (!quality.ok) {
          return res.status(422).json({
            success: false,
            error: 'QUALITY_GATE_FAILED',
            error_code: 'QUALITY_GATE_FAILED',
            action: quality.action || 'retake',
            quality,
            manual_allowed: true,
            message: quality.message,
          });
        }

        return res.json({ success: true, quality, step: 'reading' });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.21 — POST /api/patient/records/anonymous
   * Pre-auth confirmed (or draft) fact persist. Returns capture_token for OTP claim.
   * No requirePatientSession.
   * AI + file → orchestrateCapture (same machine as authenticated /capture).
   */
  app.post(
    '/api/patient/records/anonymous',
    maybeBotGuard,
    (req, res, next) => apiLimiter(req, res, next),
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data')) {
        return upload.single('file')(req, res, next);
      }
      return express.json()(req, res, next);
    },
    requireRecordTag,
    requireRecordMediaType,
    async (req, res) => {
      try {
        // Opportunistic purge of expired anonymous bundles
        try {
          purgeExpiredPendingCaptures(db.db);
        } catch (_) {}

        const tag = req.recordTag;
        const mediaType = req.recordMediaType;
        const aiOrManual = String(req.body?.ai_or_manual || 'manual').trim().toLowerCase();
        if (!AI_OR_MANUAL.includes(aiOrManual)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_AI_OR_MANUAL',
            error_code: 'INVALID_AI_OR_MANUAL',
          });
        }

        const structuredRaw = parseStructuredJsonInput(req.body?.structured_json);
        if (structuredRaw.__parse_error) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_STRUCTURED_JSON',
            error_code: 'INVALID_STRUCTURED_JSON',
          });
        }

        let rawExtract = req.body?.raw_extract_text != null ? String(req.body.raw_extract_text) : null;
        if ((tag === 'lab' || tag === 'other') && rawExtract) {
          const detected = detectLanguageStub(rawExtract);
          if (!structuredRaw.source_language && detected.source_language) {
            structuredRaw.source_language = detected.source_language;
          }
          if (!structuredRaw.display_language) {
            structuredRaw.display_language = structuredRaw.source_language || 'en';
          }
        }

        const file = req.file || null;
        const aiWantsOrchestration =
          aiOrManual === 'ai' && file?.buffer && Buffer.isBuffer(file.buffer) && file.buffer.length;

        // AI path: hints only — orchestrateCapture structures + policy-validates.
        // Manual path still requires full tag structured validation below.
        let validated = { valid: true, normalized: structuredRaw };
        if (!aiWantsOrchestration) {
          validated = validateTagStructured(tag, structuredRaw);
          if (!validated.valid) {
            return res.status(400).json({
              success: false,
              error: 'STRUCTURED_VALIDATION_FAILED',
              error_code: 'STRUCTURED_VALIDATION_FAILED',
              errors: validated.errors,
            });
          }
        }

        const existingToken = req.body?.capture_token ? String(req.body.capture_token).trim() : null;
        const pending = createOrGetPending(db.db, { captureToken: existingToken });
        const anonSessionId = pending.anon_session_id;
        const captureToken = pending.capture_token;

        const requestId = req.body?.request_id ? String(req.body.request_id).trim() : null;
        if (requestId) {
          const existing = factsRepo.getFactByRequestId(db.db, {
            sessionId: anonSessionId,
            requestId,
          });
          if (existing) {
            return res.status(200).json({
              success: true,
              fact: presentFact(existing, { db: db.db }),
              draft: existing.structured_json,
              capture_token: captureToken,
              anon_session_id: anonSessionId,
              expires_at: pending.expires_at,
              idempotent_replay: true,
            });
          }
        }

        // AI path: same orchestrateCapture as POST /records/capture (anon session owner).
        if (aiWantsOrchestration) {
          const result = await orchestrateCapture({
            db: db.db,
            tag,
            aiOrManual: 'ai',
            buffer: file.buffer,
            mimeType: file.mimetype,
            fileName: file.originalname,
            patientId: null,
            sessionId: anonSessionId,
            isPlus: false,
            userHints: structuredRaw,
            requestId,
          });
          if (!result.ok) {
            return res.status(result.status || 400).json({
              success: false,
              error: result.error,
              error_code: result.error_code,
              message: result.message,
              action: result.action,
              quality: result.quality,
              errors: result.errors,
              manual_allowed: result.manual_allowed,
              body: result.body,
            });
          }
          attachFactId(db.db, captureToken, result.fact.id);
          const confirmNow =
            req.body?.confirm === true ||
            req.body?.confirm === 'true' ||
            String(req.body?.confirmed || '').toLowerCase() === 'true';
          if (confirmNow && !result.fact.confirmed_at) {
            factsRepo.updateFactConfirm(db.db, {
              id: result.fact.id,
              sessionId: anonSessionId,
              patch: { confirmed_at: new Date().toISOString() },
            });
          }
          const presented = presentFact(
            confirmNow
              ? factsRepo.getFactById(db.db, result.fact.id) || result.fact
              : result.fact,
            { db: db.db },
          );
          return res.status(201).json({
            success: true,
            fact: presented,
            draft: result.draft || presented.structured_json,
            quality: result.quality,
            ai_or_manual: 'ai',
            capture_token: captureToken,
            anon_session_id: anonSessionId,
            expires_at: pending.expires_at,
            via: 'orchestrateCapture',
          });
        }

        let storage = { storage_ref: null, storage_provider: null, storage_key: null };
        if (file?.buffer) {
          if (!mediaType) {
            return res.status(400).json({
              success: false,
              error: 'MEDIA_TYPE_REQUIRED',
              error_code: 'MEDIA_TYPE_REQUIRED',
            });
          }
          storage = await persistRecordMedia({
            buffer: file.buffer,
            contentType: file.mimetype,
            patientId: null,
            sessionId: anonSessionId,
            fileName: file.originalname,
            mediaType,
          });
        }

        const confirmNow =
          req.body?.confirm === true ||
          req.body?.confirm === 'true' ||
          String(req.body?.confirmed || '').toLowerCase() === 'true';

        const fact = factsRepo.insertFact(db.db, {
          patient_id: null,
          session_id: anonSessionId,
          tag,
          media_type: mediaType,
          ai_or_manual: aiOrManual,
          storage_ref: storage.storage_ref,
          storage_provider: storage.storage_provider,
          storage_key: storage.storage_key,
          structured_json: validated.normalized,
          raw_extract_text: rawExtract,
          source_language: validated.normalized?.source_language || null,
          display_language: validated.normalized?.display_language || null,
          compare_group_id: validated.normalized?.compare_group_id || null,
          request_id: requestId,
          confirmed_at: confirmNow ? new Date().toISOString() : null,
        });

        attachFactId(db.db, captureToken, fact.id);

        return res.status(201).json({
          success: true,
          fact: presentFact(fact, { db: db.db }),
          draft: validated.normalized,
          capture_token: captureToken,
          anon_session_id: anonSessionId,
          expires_at: pending.expires_at,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.21 — PATCH /api/patient/records/anonymous/:id/confirm
   * Body: { capture_token, structured_json?, ... }
   */
  app.patch(
    '/api/patient/records/anonymous/:id/confirm',
    maybeBotGuard,
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    (req, res) => {
      try {
        const captureToken = String(req.body?.capture_token || '').trim();
        const pending = getPendingByToken(db.db, captureToken);
        if (!pending || pending.status !== 'pending') {
          return res.status(401).json({
            success: false,
            error: 'CAPTURE_TOKEN_REQUIRED',
            error_code: 'CAPTURE_TOKEN_REQUIRED',
          });
        }
        const exp = pending.expires_at ? new Date(pending.expires_at).getTime() : 0;
        if (exp && exp < Date.now()) {
          return res.status(410).json({ success: false, error: 'CAPTURE_EXPIRED', error_code: 'CAPTURE_EXPIRED' });
        }

        const id = String(req.params.id || '').trim();
        const existing = factsRepo.getFactById(db.db, id);
        if (!existing || existing.session_id !== pending.anon_session_id) {
          return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        let structuredRaw =
          body.structured_json != null
            ? parseStructuredJsonInput(body.structured_json)
            : { ...existing.structured_json };
        if (structuredRaw.__parse_error) {
          return res.status(400).json({ success: false, error: 'INVALID_STRUCTURED_JSON' });
        }

        const validated = validateTagStructured(existing.tag, structuredRaw);
        if (!validated.valid) {
          return res.status(400).json({
            success: false,
            error: 'STRUCTURED_VALIDATION_FAILED',
            errors: validated.errors,
          });
        }

        const prepared = prepareConfirmStructuredForPersist(existing, validated.normalized);
        if (!prepared.ok) {
          const p = prepared.policy || {};
          return res.status(400).json({
            success: false,
            error: p.error_code || 'DIAGNOSIS_VOCABULARY',
            error_code: p.error_code || 'DIAGNOSIS_VOCABULARY',
            message: p.message || 'Diagnosis vocabulary rejected',
            matches: p.matches,
            action: p.action || 'retake',
            vision_fail: true,
            manual_allowed: true,
          });
        }

        const updated = factsRepo.updateFactConfirm(db.db, {
          id,
          sessionId: pending.anon_session_id,
          patch: {
            structured_json: prepared.structured,
            source_language: body.source_language || prepared.structured?.source_language || null,
            display_language: body.display_language || prepared.structured?.display_language || null,
            confirmed_at: new Date().toISOString(),
          },
        });

        return res.json({
          success: true,
          fact: presentFact(updated, { db: db.db }),
          capture_token: captureToken,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P3.15 — POST /api/patient/records/capture
   * multipart or JSON: tag, ai_or_manual, file?, structured_json hints?, tags[] for multi
   */
  app.post(
    '/api/patient/records/capture',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res, next) => {
      const ct = String(req.headers['content-type'] || '');
      if (ct.includes('multipart/form-data')) {
        return upload.single('file')(req, res, next);
      }
      return express.json({ limit: '2mb' })(req, res, next);
    },
    async (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const aiOrManual = String(body.ai_or_manual || 'manual').trim().toLowerCase();
        if (!AI_OR_MANUAL.includes(aiOrManual)) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_AI_OR_MANUAL',
            error_code: 'INVALID_AI_OR_MANUAL',
          });
        }

        let tags = [];
        if (body.tags) {
          try {
            tags = typeof body.tags === 'string' ? JSON.parse(body.tags) : body.tags;
          } catch (_) {
            tags = [];
          }
        }
        if (!tags.length && body.tag) tags = [body.tag];
        tags = orderTagsForCapture(tags);
        if (!tags.length) {
          return res.status(400).json({
            success: false,
            error: 'TAG_REQUIRED',
            error_code: 'TAG_REQUIRED',
            allowed: RECORD_TAGS,
          });
        }

        const file = req.file || null;
        const buffer = file?.buffer || (body.file_base64
          ? Buffer.from(String(body.file_base64).replace(/^data:[^;]+;base64,/, ''), 'base64')
          : null);
        const mimeType = file?.mimetype || body.mime_type || null;
        const fileName = file?.originalname || body.file_name || null;

        let userHints = {};
        if (body.structured_json) {
          userHints = parseStructuredJsonInput(body.structured_json);
          if (userHints.__parse_error) {
            return res.status(400).json({ success: false, error: 'INVALID_STRUCTURED_JSON' });
          }
        }
        Object.assign(userHints, {
          date: body.date || userHints.date,
          note: body.note != null ? body.note : userHints.note,
          body_area: body.body_area || userHints.body_area,
          body_location: body.body_location || userHints.body_location,
          compare_group_id: body.compare_group_id || userHints.compare_group_id,
          drug: body.drug || userHints.drug,
          label: body.label || userHints.label,
          template_id: body.template_id || userHints.template_id,
          rx_kind: body.rx_kind || userHints.rx_kind,
          lab_kind: body.lab_kind || userHints.lab_kind,
        });

        const common = {
          db: db.db,
          aiOrManual,
          buffer,
          mimeType,
          fileName,
          patientId: patientId || null,
          sessionId,
          isPlus: resolveIsPlus(req),
          userHints,
          requestId: body.request_id ? String(body.request_id).trim() : null,
          qualityMeta: body.quality_meta || null,
        };

        // P3.18–20 multi-tag
        if (tags.length > 1) {
          const multi = await orchestrateMultiCapture({ ...common, tags });
          if (!multi.ok && multi.status) {
            return res.status(multi.status).json({ success: false, ...multi });
          }
          const rxResult = multi.results?.find((r) => r.tag === 'prescription' && r.fact);
          // P3.22 — never call maybeAddRxToShelf at multi create-time.
          // Rx→Shelf runs only after skin reveal advances (POST …/confirm with queue_step=reveal).
          const shelf = {
            skipped: true,
            reason: 'awaiting_skin_reveal',
            note: 'Rx→Shelf gated until skin reveal_done on capture session',
          };
          if (typeof recordPatientPortalEvent === 'function') {
            recordPatientPortalEvent(req, 'patient_record_multi_capture', {
              capture_session_id: multi.capture_session?.id,
              tags,
              has_rx: Boolean(rxResult?.fact),
            });
          }
          return res.status(201).json({
            success: true,
            capture_session: multi.capture_session,
            results: multi.results.map((r) => ({
              tag: r.tag,
              ok: r.ok,
              fact: r.fact ? presentFact(r.fact, { db: db.db }) : null,
              draft: r.draft || null,
              error: r.error || null,
              quality: r.quality || null,
            })),
            shelf_rx: shelf,
          });
        }

        const result = await orchestrateCapture({ ...common, tag: tags[0] });
        if (!result.ok) {
          return res.status(result.status || 400).json({
            success: false,
            error: result.error,
            error_code: result.error_code,
            message: result.message,
            action: result.action,
            quality: result.quality,
            errors: result.errors,
            manual_allowed: result.manual_allowed,
            body: result.body,
          });
        }

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'patient_record_captured', {
            fact_id: result.fact?.id,
            tag: tags[0],
            ai_or_manual: aiOrManual,
          });
        }

        return res.status(201).json({
          success: true,
          fact: presentFact(result.fact, { db: db.db }),
          draft: result.draft,
          quality: result.quality,
          ai_or_manual: result.ai_or_manual,
          metered: result.metered,
          idempotent_replay: result.idempotent_replay || false,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P3.16 — POST /api/patient/records/:id/confirm (alias of PATCH confirm + queue advance)
   */
  app.post(
    '/api/patient/records/:id/confirm',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const sessionId = req.patientSessionId;
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const id = String(req.params.id || '').trim();
        const existing = factsRepo.getFactById(db.db, id);
        if (!existing) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

        const ownerKey = resolveOwnerKey({ patientId, sessionId });
        const owns =
          (existing.owner_key && ownerKey && existing.owner_key === ownerKey) ||
          (patientId && existing.patient_id === patientId) ||
          (sessionId && existing.session_id === sessionId);
        if (!owns) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        let structuredRaw =
          body.structured_json != null
            ? parseStructuredJsonInput(body.structured_json)
            : { ...existing.structured_json };
        if (structuredRaw.__parse_error) {
          return res.status(400).json({ success: false, error: 'INVALID_STRUCTURED_JSON' });
        }
        if (body.source_language != null) structuredRaw.source_language = String(body.source_language);
        if (body.display_language != null) structuredRaw.display_language = String(body.display_language);

        const validated = validateTagStructured(existing.tag, structuredRaw);
        if (!validated.valid) {
          return res.status(400).json({
            success: false,
            error: 'STRUCTURED_VALIDATION_FAILED',
            errors: validated.errors,
          });
        }

        const prepared = prepareConfirmStructuredForPersist(existing, validated.normalized);
        if (!prepared.ok) {
          const p = prepared.policy || {};
          return res.status(400).json({
            success: false,
            error: p.error_code || 'DIAGNOSIS_VOCABULARY',
            error_code: p.error_code || 'DIAGNOSIS_VOCABULARY',
            message: p.message || 'Diagnosis vocabulary rejected',
            matches: p.matches,
            action: p.action || 'retake',
            vision_fail: true,
            manual_allowed: true,
          });
        }

        const updated = factsRepo.updateFactConfirm(db.db, {
          id,
          patientId,
          sessionId,
          patch: {
            structured_json: prepared.structured,
            source_language: prepared.structured?.source_language || null,
            display_language: prepared.structured?.display_language || null,
            compare_group_id: body.compare_group_id != null ? body.compare_group_id : prepared.structured?.compare_group_id,
            raw_extract_text: body.raw_extract_text != null ? body.raw_extract_text : existing.raw_extract_text,
            confirmed_at: new Date().toISOString(),
          },
        });

        let capture_session = null;
        let shelf_rx = null;
        if (body.capture_session_id) {
          capture_session = advanceCaptureQueue(db.db, String(body.capture_session_id), {
            factId: id,
            tag: existing.tag,
            step: body.queue_step || 'confirm',
          });
          // P3.21 reveal/thesis steps (queue flags only — product UI/copy is P7)
          if (body.queue_step === 'reveal' || body.mark_reveal) {
            capture_session = advanceCaptureQueue(db.db, String(body.capture_session_id), {
              factId: id,
              tag: existing.tag,
              step: 'reveal',
            });
            // After skin reveal, attach pending Rx from this multi-tag session to shelf
            if (existing.tag === 'skin' && capture_session?.queue) {
              const rxStep = capture_session.queue.find(
                (q) => q.tag === 'prescription' && q.fact_id,
              );
              if (rxStep?.fact_id) {
                const rxFact = factsRepo.getFactById(db.db, rxStep.fact_id);
                if (rxFact) {
                  shelf_rx = maybeAddRxToShelf(db.db, {
                    patientId,
                    sessionId,
                    prescriptionFact: rxFact,
                    requireSkinReveal: true,
                    captureSession: capture_session,
                  });
                }
              }
            }
          }
          if (body.queue_step === 'thesis' || body.mark_thesis) {
            capture_session = advanceCaptureQueue(db.db, String(body.capture_session_id), {
              factId: id,
              tag: existing.tag,
              step: 'thesis',
            });
          }
        }

        if (existing.tag === 'prescription' && body.add_to_shelf) {
          shelf_rx = maybeAddRxToShelf(db.db, {
            patientId,
            sessionId,
            prescriptionFact: updated,
            requireSkinReveal: Boolean(body.capture_session_id),
            captureSession: capture_session,
          });
        }

        if (typeof recordPatientPortalEvent === 'function') {
          recordPatientPortalEvent(req, 'patient_record_confirmed', { fact_id: id, tag: existing.tag });
        }

        return res.json({
          success: true,
          fact: presentFact(updated, { db: db.db }),
          capture_session,
          shelf_rx,
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  app.get(
    '/api/patient/records/capture-sessions/:id',
    (req, res, next) => apiLimiter(req, res, next),
    requirePatientSession,
    (req, res) => {
      try {
        const sess = getCaptureSession(db.db, String(req.params.id || '').trim());
        if (!sess) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const owned = assertRecordOwnedByCaller(sess, {
          patientId,
          sessionId: req.patientSessionId,
        });
        if (!owned.ok) {
          return res.status(owned.status).json({
            success: false,
            error: owned.error,
            error_code: owned.code || owned.error,
          });
        }
        return res.json({ success: true, capture_session: sess });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );

  /**
   * P2.29 — GET /api/patient/records/media/:token — short-TTL token redirect/serve
   */
  app.get(
    '/api/patient/records/media/:token',
    (req, res, next) => apiLimiter(req, res, next),
    (req, res) => {
      try {
        const entry = consumeMediaToken(String(req.params.token || ''), db.db);
        if (!entry) return res.status(410).send('Expired or invalid');

        if (
          entry.storage_provider === 'azure' &&
          entry.storage_key &&
          BlobStorage.isAzureConfigured &&
          BlobStorage.isAzureConfigured()
        ) {
          const signed = BlobStorage.generateSignedUrl({
            blobName: entry.storage_key,
            expiresInSeconds: 120,
          });
          return res.redirect(signed);
        }

        // Local/dev: do not stream file bytes in this phase — return opaque ack
        return res.status(200).json({
          success: true,
          storage_ref: entry.storage_ref && !/^https?:\/\//i.test(entry.storage_ref)
            ? entry.storage_ref
            : null,
          message: 'media_token_valid',
        });
      } catch (e) {
        return res.status(500).send('Internal error');
      }
    },
  );

  /**
   * P8.06 — Translate already-stored lab extract for display (English SSOT; no re-OCR).
   */
  app.post(
    '/api/patient/records/:id/lab-translate',
    (req, res, next) => apiLimiter(req, res, next),
    express.json(),
    requirePatientSession,
    (req, res) => {
      try {
        const { translateLabDisplayText } = require('../services/lab-translate');
        const id = String(req.params.id || '').trim();
        const fact = factsRepo.getFactById(db.db, id);
        if (!fact) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        const { patientId } = resolvePatientIdFromSession(req.patientSession || {});
        const owned = assertRecordOwnedByCaller(fact, {
          patientId,
          sessionId: req.patientSessionId,
        });
        if (!owned.ok) {
          return res.status(owned.status).json({
            success: false,
            error: owned.error,
            error_code: owned.code || owned.error,
          });
        }
        if (fact.tag !== 'lab') {
          return res.status(400).json({ success: false, error_code: 'NOT_A_LAB_FACT' });
        }
        const sourceText =
          fact.raw_extract_text ||
          fact.structured_json?.free_text ||
          fact.structured_json?.title ||
          '';
        const out = translateLabDisplayText({
          sourceText,
          source_language: fact.source_language || 'en',
          target_language: req.body?.target_language || fact.display_language || 'en',
        });
        if (!out.ok) {
          return res.status(400).json({ success: false, error_code: out.error_code });
        }
        return res.json({
          success: true,
          ...out,
          scope: 'translate_stored_english_extract_only',
        });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    },
  );
}

module.exports = { registerPatientRecordRoutes, assertRecordOwnedByCaller };
