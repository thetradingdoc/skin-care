'use strict';

/**
 * P3.01 — Capture orchestration entrypoint.
 *
 * Flow: quality (unmetered) → meter (if AI) → perceive → structure → persist draft fact.
 * Manual path skips meter + AI (P3.14).
 */

const { assessCaptureQuality } = require('./quality-gate');
const { meterGuard, meterRefund, meterRecordTokens } = require('./meter-guard');
const { perceiveSkinVision, perceiveDocOcr } = require('./perceive');
const { structureByTag } = require('./structure-by-tag');
const { persistRecordMedia, deleteRecordMedia } = require('../patient-record-media');
const factsRepo = require('../../repositories/patient-record-facts-repo');
const { RECORD_TAGS } = require('../patient-record-fact-validators');
const {
  orderTagsForCapture,
  createCaptureSession,
  getCaptureSession,
  advanceCaptureQueue,
} = require('./capture-session');
const {
  assertOrchestrationPersistPolicy,
} = require('../medical-tracker-rails/policy');

const DOC_TAGS = new Set(['bill', 'prescription', 'lab', 'other']);
const VISION_TAGS = new Set(['skin', 'mark']);

/**
 * Fail closed before insertFact — maps to vision-fail / retake (screen 2c).
 * Never silently strip diagnosis text or persist unscrubbed prose.
 */
function policyRejectBeforePersist(policy, extras = {}) {
  return {
    ok: false,
    status: 422,
    error: policy.error_code || 'DIAGNOSIS_VOCABULARY',
    error_code: policy.error_code || 'DIAGNOSIS_VOCABULARY',
    message: policy.message || 'Capture blocked by medical safety policy',
    action: policy.action || 'retake',
    vision_fail: policy.vision_fail !== false,
    manual_allowed: true,
    matches: policy.matches || undefined,
    keys: policy.keys || undefined,
    ...extras,
  };
}

function captureKindForTag(tag) {
  if (tag === 'skin' || tag === 'mark') return 'capture_skin_vision';
  if (tag === 'bill') return 'billing_ocr';
  return 'capture_doc_ocr';
}

/**
 * @param {object} opts
 * @param {object} opts.db
 * @param {string} opts.tag
 * @param {'ai'|'manual'} opts.aiOrManual
 * @param {Buffer|null} opts.buffer
 * @param {string|null} opts.mimeType
 * @param {string|null} opts.fileName
 * @param {string|null} opts.patientId
 * @param {string|null} opts.sessionId
 * @param {boolean} [opts.isPlus]
 * @param {object} [opts.userHints]
 * @param {string|null} [opts.requestId]
 * @param {boolean} [opts.skipPersist] — structure only
 */
async function orchestrateCapture(opts = {}) {
  const db = opts.db;
  const tag = String(opts.tag || '').trim().toLowerCase();
  const aiOrManual = String(opts.aiOrManual || 'manual').trim().toLowerCase() === 'ai' ? 'ai' : 'manual';
  const buffer = opts.buffer || null;
  const mimeType = opts.mimeType || null;
  const fileName = opts.fileName || null;
  const patientId = opts.patientId || null;
  const sessionId = opts.sessionId || null;
  const isPlus = Boolean(opts.isPlus);
  const userHints = opts.userHints && typeof opts.userHints === 'object' ? opts.userHints : {};
  const requestId = opts.requestId ? String(opts.requestId).trim() : null;

  if (!RECORD_TAGS.includes(tag)) {
    return { ok: false, status: 400, error: 'INVALID_TAG', error_code: 'INVALID_TAG', allowed: RECORD_TAGS };
  }

  // P8.02 — AV scan on all six-tag uploads (fail-closed medical path)
  if (buffer && Buffer.isBuffer(buffer) && buffer.length) {
    const { assertMedicalUploadAllowed } = require('../patient-record-media-gate');
    const mediaReject = assertMedicalUploadAllowed({
      buffer,
      mimeType,
      fileName,
    });
    if (mediaReject) {
      return {
        ...mediaReject,
        error: mediaReject.error_code,
      };
    }

    const AntivirusService = require('../antivirus-service');
    const avResult = await AntivirusService.scanPatientRecordBuffer(buffer);
    if (!avResult.safe) {
      return {
        ok: false,
        status: 403,
        error: avResult.error_code || 'AV_SCAN_BLOCKED',
        error_code: avResult.error_code || 'AV_SCAN_BLOCKED',
        message: avResult.error || AntivirusService.BLOCKED_MESSAGE,
        manual_allowed: false,
      };
    }
  }

  // Idempotent replay
  if (requestId && db) {
    const existing = factsRepo.getFactByRequestId(db, { patientId, sessionId, requestId });
    if (existing) {
      return { ok: true, idempotent_replay: true, fact: existing, draft: existing.structured_json };
    }
  }

  // P3.14 — manual: no meter, optional media, structure from hints only
  if (aiOrManual === 'manual') {
    let storage = { storage_ref: null, storage_provider: null, storage_key: null };
    if (buffer && Buffer.isBuffer(buffer) && buffer.length) {
      const { isPdfForCaptureRouting: isPdfMedia } = require('../patient-record-media-gate');
      const mediaType = isPdfMedia({ buffer, mimeType, fileName }) ? 'pdf' : 'photo';
      storage = await persistRecordMedia({
        buffer,
        contentType: mimeType,
        patientId,
        sessionId,
        fileName,
        mediaType,
      });
    }
    const structured = structureByTag(tag, {
      userHints,
      ocrText: userHints.raw_extract_text || null,
      photoRef: storage.storage_ref,
    });
    if (!structured.valid) {
      return {
        ok: false,
        status: 400,
        error: 'STRUCTURED_VALIDATION_FAILED',
        error_code: 'STRUCTURED_VALIDATION_FAILED',
        errors: structured.errors,
      };
    }
    const policyInput =
      tag === 'prescription'
        ? { ...structured.normalized, ...userHints }
        : structured.normalized;
    // Never trust client-supplied field_provenance on hints — only server-stamped map
    const trustedProvenance =
      structured.normalized?.field_provenance && typeof structured.normalized.field_provenance === 'object'
        ? structured.normalized.field_provenance
        : null;
    const policy = assertOrchestrationPersistPolicy(tag, policyInput, { trustedProvenance });
    if (!policy.ok) {
      return policyRejectBeforePersist(policy);
    }
    if (opts.skipPersist) {
      return { ok: true, draft: structured.normalized, structured, ai_or_manual: 'manual' };
    }
    const fact = factsRepo.insertFact(db, {
      patient_id: patientId,
      session_id: sessionId,
      tag,
      media_type: storage.storage_ref
        ? String(mimeType || '').includes('pdf')
          ? 'pdf'
          : 'photo'
        : null,
      ai_or_manual: 'manual',
      storage_ref: storage.storage_ref,
      storage_provider: storage.storage_provider,
      storage_key: storage.storage_key,
      structured_json: structured.normalized,
      raw_extract_text: structured.raw_extract_text || null,
      source_language: structured.normalized?.source_language || null,
      display_language: structured.normalized?.display_language || null,
      compare_group_id: structured.normalized?.compare_group_id || null,
      request_id: requestId,
      confirmed_at: null,
    });
    return {
      ok: true,
      fact,
      draft: structured.normalized,
      ai_or_manual: 'manual',
      quality: null,
      metered: false,
    };
  }

  // AI path — quality first (P3.03), unmetered
  const quality = assessCaptureQuality({ buffer, mimeType, tag, meta: opts.qualityMeta });
  if (!quality.ok) {
    return {
      ok: false,
      status: 422,
      error: 'QUALITY_GATE_FAILED',
      error_code: 'QUALITY_GATE_FAILED',
      action: quality.action,
      quality,
      manual_allowed: true,
      message: quality.message,
    };
  }

  const { isPdfForCaptureRouting } = require('../patient-record-media-gate');
  const isPdf = isPdfForCaptureRouting({ buffer, mimeType, fileName });

  /**
   * PDF text-layer fast path (Part A): extract embedded text BEFORE metering.
   * Vision/OCR still metered. Text-layer PDFs do not consume AI credits.
   * Gated on real %PDF- magic (first 1KB), not filename / MIME alone.
   */
  let preDoc = null;
  if (DOC_TAGS.has(tag) && isPdf && buffer && Buffer.isBuffer(buffer)) {
    preDoc = await perceiveDocOcr({ buffer, mimeType, fileName });
    if (preDoc?.method === 'pdf-text-layer' && preDoc.text && preDoc.used_ai === false) {
      // Fall through to structure without meter
    } else if (preDoc?.used_ai) {
      // Needs vision — meter below then reuse preDoc result
    } else {
      // Weak/empty layer without vision result — still try metered path only if vision needed
      preDoc = preDoc?.text ? preDoc : null;
    }
  }

  const needsAiMeter =
    VISION_TAGS.has(tag) ||
    (DOC_TAGS.has(tag) && !(preDoc && preDoc.method === 'pdf-text-layer' && preDoc.used_ai === false));

  let gate = { ok: true, usageId: null };
  if (needsAiMeter) {
    gate = meterGuard(db, {
      patientId,
      sessionId,
      captureKind: captureKindForTag(tag),
      isPlus,
      model: 'gpt-4o',
    });
    if (!gate.ok) {
      return {
        ok: false,
        status: gate.status,
        error: gate.body?.error_code || 'AI_CAPTURE_LIMIT',
        error_code: gate.body?.error_code || 'AI_CAPTURE_LIMIT',
        body: gate.body,
        manual_allowed: true,
      };
    }
  }

  let vision = null;
  let ocrText = '';
  let extraction = null;
  let perceiveOk = false;
  let perceiveMethod = null;
  let usedAi = false;

  try {
    if (VISION_TAGS.has(tag)) {
      const perc = await perceiveSkinVision(buffer, mimeType);
      vision = perc.vision;
      usedAi = true;
      if (vision && typeof vision === 'object') {
        const {
          FACE_ONLY_REJECT_REASONS,
          HARD_VISION_REJECT_REASONS,
          normalizeVisionPayload,
        } = require('../face-read-vision');
        // Body skin is valid — never hard-fail on legacy face-only rejects.
        if (
          FACE_ONLY_REJECT_REASONS.includes(String(vision.reject_reason || '')) ||
          vision.quality === 'no_face' ||
          vision.quality === 'wrong_subject'
        ) {
          vision =
            normalizeVisionPayload({
              ...vision,
              reject_reason: null,
              quality: vision.quality === 'low' ? 'low' : 'ok',
            }) || {
              ...vision,
              reject_reason: null,
              quality: 'ok',
              user_message: null,
            };
        }
        const hardReject =
          HARD_VISION_REJECT_REASONS.includes(String(vision.reject_reason || '')) ||
          vision.quality === 'reject';
        if (hardReject) {
          meterRefund(db, gate.usageId, 'vision_quality_reject');
          return {
            ok: false,
            status: 422,
            error: 'QUALITY_GATE_FAILED',
            error_code: 'QUALITY_GATE_FAILED',
            action: 'retake',
            quality: {
              ok: false,
              action: 'retake',
              quality_issues: [vision.reject_reason || 'reject'],
              message: vision.user_message || 'Retake photo',
            },
            manual_allowed: true,
          };
        }
      }
      perceiveOk = Boolean(perc.ok && vision);
    } else if (DOC_TAGS.has(tag)) {
      const perc =
        preDoc && (preDoc.method === 'pdf-text-layer' || preDoc.used_ai)
          ? preDoc
          : await perceiveDocOcr({ buffer, mimeType, fileName });
      ocrText = perc.text || '';
      perceiveOk = perc.ok !== false && ocrText.length > 0;
      perceiveMethod = perc.method || null;
      usedAi = perc.used_ai === true;
      // APP-02: text-layer never enters the metered branch (needsAiMeter false above).
      // Do not meter-then-refund here — that path was deleted.
      if (tag === 'bill') {
        const { parseBillingFieldsFromText } = require('../billing-ocr-parser');
        extraction = parseBillingFieldsFromText({ text: ocrText, mimeType, fileName });
      }
    } else {
      perceiveOk = false;
    }
  } catch (e) {
    if (gate.usageId) meterRefund(db, gate.usageId, `perceive_error:${e.message}`);
    const heic =
      e.code === 'HEIC_UNSUPPORTED' || String(e.message || '').includes('HEIC_UNSUPPORTED');
    return {
      ok: false,
      status: heic ? 422 : 500,
      error: heic ? 'HEIC_UNSUPPORTED' : 'PERCEIVE_FAILED',
      error_code: heic ? 'HEIC_UNSUPPORTED' : 'PERCEIVE_FAILED',
      message: heic
        ? 'HEIC photos are not supported for AI reads. Retake or upload as JPEG/PNG.'
        : e.message,
      manual_allowed: true,
    };
  }

  if (!perceiveOk && DOC_TAGS.has(tag)) {
    if (gate.usageId) meterRefund(db, gate.usageId, 'ocr_empty');
    return {
      ok: false,
      status: 422,
      error: 'OCR_EMPTY',
      error_code: 'OCR_EMPTY',
      action: 'retake',
      vision_fail: true,
      manual_allowed: true,
      message:
        'Could not read any text from this document. Retake, re-upload, or enter details manually.',
      quality,
      perceive_method: perceiveMethod,
      used_ai: usedAi,
      metered: false,
    };
  } else if (!perceiveOk && VISION_TAGS.has(tag) && !vision) {
    if (gate.usageId) meterRefund(db, gate.usageId, 'vision_empty');
    return {
      ok: false,
      status: 503,
      error: 'VISION_UNAVAILABLE',
      error_code: 'VISION_UNAVAILABLE',
      manual_allowed: true,
      message: 'AI vision unavailable. Enter details manually.',
    };
  } else if (perceiveOk && gate.usageId && usedAi) {
    try {
      meterRecordTokens(db, gate.usageId, {
        model: 'gpt-4o',
        promptTokens: vision?._usage?.prompt_tokens,
        completionTokens: vision?._usage?.completion_tokens,
      });
    } catch (_) {}
  }

  let storage = { storage_ref: null, storage_provider: null, storage_key: null };
  if (buffer && Buffer.isBuffer(buffer)) {
    const mediaType = isPdf ? 'pdf' : 'photo';
    storage = await persistRecordMedia({
      buffer,
      contentType: mimeType,
      patientId,
      sessionId,
      fileName,
      mediaType,
    });
  }

  const structured = structureByTag(tag, {
    vision,
    ocrText,
    extraction,
    userHints,
    photoRef: storage.storage_ref,
    mimeType,
    fileName,
  });

  if (!structured.valid) {
    if (gate.usageId) meterRefund(db, gate.usageId, 'structured_validation_failed');
    // STOR-06: media was written before structure — delete orphan
    if (storage.storage_ref) {
      await deleteRecordMedia(storage);
    }
    return {
      ok: false,
      status: 400,
      error: 'STRUCTURED_VALIDATION_FAILED',
      error_code: 'STRUCTURED_VALIDATION_FAILED',
      errors: structured.errors,
      quality,
      manual_allowed: true,
    };
  }

  const policyInput =
    tag === 'prescription'
      ? { ...structured.normalized, ...userHints }
      : structured.normalized;
  const trustedProvenance =
    structured.normalized?.field_provenance && typeof structured.normalized.field_provenance === 'object'
      ? structured.normalized.field_provenance
      : null;
  const policy = assertOrchestrationPersistPolicy(tag, policyInput, { trustedProvenance });
  if (!policy.ok) {
    if (gate.usageId) meterRefund(db, gate.usageId, `policy:${policy.error_code}`);
    if (storage.storage_ref) {
      await deleteRecordMedia(storage);
    }
    return policyRejectBeforePersist(policy, { quality });
  }

  /**
   * APP-02 — PDF text-layer is never metered and stamped `manual`.
   * Tradeoff (locked): text-layer extraction is permanently indistinguishable from true
   * manual entry on `ai_or_manual` / analytics. Prefer `perceive_method` + `used_ai` +
   * `metered` for extraction-source honesty. See docs/product/TOUCHE_AGENTIC_ARCHITECTURE.md
   * and todos/pending for APP-02 provenance note.
   */
  const isPdfTextLayerUnmetered =
    perceiveMethod === 'pdf-text-layer' && usedAi === false && !gate.usageId;
  const stampedAiOrManual = isPdfTextLayerUnmetered ? 'manual' : 'ai';

  if (opts.skipPersist) {
    return {
      ok: true,
      draft: structured.normalized,
      structured,
      quality,
      ai_or_manual: stampedAiOrManual,
      metered: Boolean(gate.usageId),
      used_ai: usedAi,
      perceive_method: perceiveMethod,
      usage_id: gate.usageId,
    };
  }

  const fact = factsRepo.insertFact(db, {
    patient_id: patientId,
    session_id: sessionId,
    tag,
    media_type: storage.storage_ref ? (isPdf ? 'pdf' : 'photo') : null,
    ai_or_manual: stampedAiOrManual,
    storage_ref: storage.storage_ref,
    storage_provider: storage.storage_provider,
    storage_key: storage.storage_key,
    structured_json: structured.normalized,
    raw_extract_text: structured.raw_extract_text || ocrText || null,
    source_language: structured.normalized?.source_language || null,
    display_language: structured.normalized?.display_language || null,
    compare_group_id: structured.normalized?.compare_group_id || null,
    request_id: requestId,
    confirmed_at: null,
  });

  return {
    ok: true,
    fact,
    draft: structured.normalized,
    quality,
    ai_or_manual: stampedAiOrManual,
    metered: Boolean(gate.usageId),
    used_ai: usedAi,
    perceive_method: perceiveMethod,
    usage_id: gate.usageId,
    extraction: extraction || null,
  };
}

/**
 * P3.20 — Run ordered multi-tag capture (same media, multiple tags).
 */
async function orchestrateMultiCapture(opts = {}) {
  const tags = orderTagsForCapture(opts.tags || []);
  if (!tags.length) {
    return { ok: false, status: 400, error: 'TAGS_REQUIRED', error_code: 'TAGS_REQUIRED' };
  }
  const session = createCaptureSession(opts.db, {
    patientId: opts.patientId,
    sessionId: opts.sessionId,
    tags,
    captureToken: opts.captureToken || null,
  });

  const results = [];
  for (const tag of tags) {
    const one = await orchestrateCapture({
      ...opts,
      tag,
      // Only first AI tag meters aggressively; subsequent tags can still meter separately
      requestId: opts.requestId ? `${opts.requestId}:${tag}` : null,
    });
    results.push({ tag, ...one });
    if (one.ok && one.fact) {
      advanceCaptureQueue(opts.db, session.id, { factId: one.fact.id, tag, step: 'confirm' });
    }
  }

  return {
    ok: results.every((r) => r.ok),
    capture_session: getCaptureSession(opts.db, session.id),
    results,
  };
}

/**
 * P3.22 — After skin reveal (multi-tag order) or explicit add_to_shelf, push Rx onto shelf.
 * Uses the same row shape as POST /api/patient/shelf/products (not a parallel schema).
 */
function maybeAddRxToShelf(db, {
  patientId,
  sessionId,
  prescriptionFact,
  requireSkinReveal = false,
  captureSession = null,
}) {
  if (!prescriptionFact || prescriptionFact.tag !== 'prescription') return null;
  if (!sessionId) return { skipped: true, reason: 'session_required' };
  const drug = prescriptionFact.structured_json?.drug;
  if (!drug || drug === 'unknown') return null;

  if (requireSkinReveal) {
    // Strict gate: multi-tag Rx→Shelf MUST see skin.reveal_done === true.
    // Missing session / missing skin step / reveal not done → skip (never insert).
    const skinStep = (captureSession?.queue || []).find((q) => q.tag === 'skin');
    if (!skinStep || skinStep.reveal_done !== true) {
      return { skipped: true, reason: 'awaiting_skin_reveal' };
    }
  }

  try {
    const { v4: uuidv4 } = require('uuid');
    const tables = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='patient_onboarding_step3_products'`,
      )
      .get();
    if (!tables) return { skipped: true, reason: 'shelf_table_missing' };

    const cols = db.prepare(`PRAGMA table_info(patient_onboarding_step3_products)`).all();
    const names = new Set(cols.map((c) => c.name));
    const id = `shelf_${uuidv4().slice(0, 12)}`;
    const ingredientsText = prescriptionFact.structured_json?.strength
      ? `strength:${prescriptionFact.structured_json.strength}`
      : null;

    // Real shelf schema (server.js / patient-shelf.js)
    if (names.has('custom_product_name') && names.has('selection_mode')) {
      db.prepare(
        `INSERT INTO patient_onboarding_step3_products (
          id, session_id, patient_id, selection_mode, custom_product_name, custom_brand,
          category, usage_time, goal, key_ingredients, ingredients_text
        ) VALUES (?, ?, ?, 'custom', ?, NULL, 'prescription', 'as_directed', 'conflict_track', NULL, ?)`,
      ).run(id, sessionId, patientId || null, String(drug).slice(0, 200), ingredientsText);
    } else if (names.has('product_name')) {
      // Test / legacy minimal table
      db.prepare(
        `INSERT INTO patient_onboarding_step3_products (
          id, session_id, patient_id, product_name, category, usage_time, ingredients_text, created_at
        ) VALUES (?, ?, ?, ?, 'prescription', 'as_directed', ?, datetime('now'))`,
      ).run(id, sessionId, patientId || null, String(drug).slice(0, 200), ingredientsText);
    } else {
      return { skipped: true, reason: 'shelf_schema_unknown' };
    }

    return { ok: true, product_id: id, product_name: drug };
  } catch (e) {
    console.warn('[capture] Rx→shelf failed:', e.message);
    return { ok: false, error: e.message };
  }
}

module.exports = {
  orchestrateCapture,
  orchestrateMultiCapture,
  maybeAddRxToShelf,
  captureKindForTag,
};
