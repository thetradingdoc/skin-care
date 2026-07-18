'use strict';

/**
 * P4.03 — Medical-tracker tool executor.
 * Rejects tools outside medical allowlists. Never executes shelf/Kelly/commerce tools.
 */

const { getMedicalToolNames } = require('./medical-tool-definitions');
const { isToolAllowed, ALL_MEDICAL_TOOLS } = require('./medical-tool-allowlists');
const { validateTagStructured } = require('../patient-record-fact-validators');
const { detectLanguageStub } = require('../patient-record-language-stub');
const { structureByTag } = require('../capture-orchestration/structure-by-tag');
const { assessCaptureQuality } = require('../capture-orchestration/quality-gate');
const factsRepo = require('../../repositories/patient-record-facts-repo');
const { presentFact } = require('../patient-record-media-access');
const {
  assertNoDiagnosisVocabulary,
  assertAiSuggestionShape,
  assertPositiveMedicalTextShape,
  assertSafeToPersistStructured,
  stripCommerceFromPrescription,
  assertNoCommerceOnPrescription,
  buildSkinDeltaSuggestion,
} = require('./policy');

const KNOWN = new Set(getMedicalToolNames());

async function executeMedicalTool(name, args, ctx = {}) {
  const tool = String(name || '').trim();
  const graphKind = ctx.graphKind || null;

  if (!KNOWN.has(tool) || !ALL_MEDICAL_TOOLS.has(tool)) {
    return {
      success: false,
      error: 'TOOL_NOT_IN_MEDICAL_ALLOWLIST',
      error_code: 'TOOL_NOT_IN_MEDICAL_ALLOWLIST',
      tool,
    };
  }
  if (graphKind && !isToolAllowed(graphKind, tool)) {
    return {
      success: false,
      error: 'TOOL_NOT_ALLOWED_FOR_GRAPH',
      error_code: 'TOOL_NOT_ALLOWED_FOR_GRAPH',
      tool,
      graphKind,
    };
  }

  const db = ctx.db;
  const patientId = ctx.patientId || null;
  const sessionId = ctx.sessionId || null;

  switch (tool) {
    case 'assess_quality': {
      let buffer = null;
      if (args?.buffer_base64) {
        buffer = Buffer.from(String(args.buffer_base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
      } else if (ctx.buffer && Buffer.isBuffer(ctx.buffer)) {
        buffer = ctx.buffer;
      }
      const quality = assessCaptureQuality({
        buffer,
        mimeType: args?.mime_type || ctx.mimeType,
        tag: args?.tag || ctx.tag,
        meta: args?.meta || null,
      });
      return { success: true, quality };
    }

    case 'get_extract': {
      // Metering is the caller's job (meter_guard pre-node). Executor only extracts.
      try {
        const gcs = require('../gcs-billing-storage');
        const extractionService = require('../patient-document-extraction');
        let buf = null;
        if (args?.buffer_base64) {
          buf = Buffer.from(String(args.buffer_base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
        } else if (ctx.buffer && Buffer.isBuffer(ctx.buffer)) {
          buf = ctx.buffer;
        } else if (args?.storage_ref) {
          buf = await gcs.downloadBuffer(args.storage_ref);
        }
        if (!buf) {
          return { success: false, error: 'NO_MEDIA', error_code: 'NO_MEDIA' };
        }
        const extracted = await extractionService.extractText({
          storagePath: null,
          buffer: buf,
          mimeType: args?.mime_type || ctx.mimeType || null,
          fileName: args?.file_name || ctx.fileName || null,
        });
        const text = String(extracted?.text || '').trim();
        const policy = assertNoDiagnosisVocabulary(text);
        return {
          success: true,
          text: policy.clean_text,
          method: extracted?.method || 'unknown',
          policy,
        };
      } catch (e) {
        return { success: false, error: e.message, error_code: 'EXTRACT_FAILED' };
      }
    }

    case 'detect_language': {
      return { success: true, ...detectLanguageStub(args?.text || ctx.rawExtractText || '') };
    }

    case 'structure_by_tag': {
      const tag = args?.tag || ctx.tag;
      const structured = structureByTag(tag, {
        ocrText: args?.ocr_text || ctx.rawExtractText || '',
        vision: args?.vision || ctx.vision || null,
        userHints: args?.user_hints || ctx.userHints || {},
        mimeType: args?.mime_type || ctx.mimeType,
        fileName: args?.file_name || ctx.fileName,
      });
      if (!structured?.valid) {
        return { success: false, error: 'STRUCTURE_INVALID', errors: structured?.errors || [] };
      }
      const normalized = stripCommerceFromPrescription(tag, structured.normalized);
      const shape = assertAiSuggestionShape(normalized);
      if (!shape.ok) {
        return { success: false, error: shape.error_code, error_code: shape.error_code, message: shape.message };
      }
      const vocab = assertNoDiagnosisVocabulary(JSON.stringify(normalized));
      if (!vocab.ok) {
        return {
          success: false,
          error: 'DIAGNOSIS_VOCABULARY',
          error_code: 'DIAGNOSIS_VOCABULARY',
          matches: vocab.matches,
        };
      }
      return { success: true, structured_json: normalized, tag };
    }

    case 'normalize_facts': {
      const tag = args?.tag || ctx.tag;
      const raw = args?.structured_json || {};
      if (String(tag) === 'prescription') {
        const commerce = assertNoCommerceOnPrescription(raw);
        if (!commerce.ok) {
          return {
            success: false,
            error: commerce.error_code,
            error_code: commerce.error_code,
            keys: commerce.keys,
            message: commerce.message,
          };
        }
      }
      // Validate raw first so P2.04 schema layer sees commerce keys (defense in depth)
      const validated = validateTagStructured(tag, raw);
      if (!validated.valid) {
        return {
          success: false,
          error: 'INVALID_STRUCTURED',
          errors: validated.errors,
          forbidden_commerce_keys: validated.forbidden_commerce_keys,
        };
      }
      const persistGate = assertSafeToPersistStructured(validated.normalized);
      if (!persistGate.ok) {
        return {
          success: false,
          error: persistGate.error_code,
          error_code: persistGate.error_code,
          keys: persistGate.keys,
          matches: persistGate.matches,
          message: persistGate.message,
        };
      }
      const shape = assertAiSuggestionShape(validated.normalized);
      if (!shape.ok) {
        return { success: false, error: shape.error_code, error_code: shape.error_code };
      }
      return { success: true, structured_json: validated.normalized, tag };
    }

    case 'format_confirm_draft': {
      const tag = args?.tag || ctx.tag;
      const raw = args?.structured_json || {};
      if (String(tag) === 'prescription') {
        const commerce = assertNoCommerceOnPrescription(raw);
        if (!commerce.ok) {
          return {
            success: false,
            error: commerce.error_code,
            error_code: commerce.error_code,
            keys: commerce.keys,
            message: commerce.message,
          };
        }
      }
      const validated = validateTagStructured(tag, raw);
      if (!validated.valid) {
        return {
          success: false,
          error: 'INVALID_STRUCTURED',
          errors: validated.errors,
          forbidden_commerce_keys: validated.forbidden_commerce_keys,
        };
      }
      const persistGate = assertSafeToPersistStructured(validated.normalized);
      if (!persistGate.ok) {
        return {
          success: false,
          error: persistGate.error_code,
          error_code: persistGate.error_code,
          keys: persistGate.keys,
          matches: persistGate.matches,
          message: persistGate.message,
        };
      }
      const shape = assertAiSuggestionShape(validated.normalized);
      if (!shape.ok) {
        return { success: false, error: shape.error_code, error_code: shape.error_code };
      }
      const vocab = assertNoDiagnosisVocabulary(JSON.stringify(validated.normalized));
      if (!vocab.ok) {
        return {
          success: false,
          error: 'DIAGNOSIS_VOCABULARY',
          error_code: 'DIAGNOSIS_VOCABULARY',
          matches: vocab.matches,
        };
      }
      return {
        success: true,
        draft: {
          tag,
          structured_json: validated.normalized,
          raw_extract_text: args?.raw_extract_text != null ? String(args.raw_extract_text) : null,
          ai_suggestion: validated.normalized.ai_suggestion || null,
        },
      };
    }

    case 'get_prior_skin_facts': {
      if (!db) return { success: false, error: 'DB_REQUIRED' };
      const facts = factsRepo.listFacts(db, {
        patientId,
        sessionId,
        tag: 'skin',
        endIso: args?.before_date || null,
        limit: Math.min(20, Number(args?.limit) || 5),
      });
      return {
        success: true,
        facts: facts.map((f) => ({
          id: f.id,
          confirmed_at: f.confirmed_at,
          structured_json: f.structured_json,
        })),
      };
    }

    case 'list_facts_for_export': {
      if (!db) return { success: false, error: 'DB_REQUIRED' };
      const facts = factsRepo.listFacts(db, {
        patientId,
        sessionId,
        tag: args?.tag || null,
        startIso: args?.start || null,
        endIso: args?.end || null,
        limit: Math.min(200, Number(args?.limit) || 100),
      });
      return {
        success: true,
        facts: facts.map((f) => presentFact(f, { db })),
        narrative: null,
        interpretation: null,
        ai_generated: false,
      };
    }

    case 'suggest_skin_delta': {
      const suggestion = buildSkinDeltaSuggestion({
        prior: args?.prior_structured || {},
        today: args?.today_structured || {},
      });
      const vocab = assertNoDiagnosisVocabulary(JSON.stringify(suggestion));
      if (!vocab.ok) {
        return {
          success: false,
          error: 'DIAGNOSIS_VOCABULARY',
          error_code: 'DIAGNOSIS_VOCABULARY',
          matches: vocab.matches,
        };
      }
      return { success: true, ai_suggestion: suggestion };
    }

    default:
      return { success: false, error: 'UNHANDLED_TOOL', tool };
  }
}

module.exports = { executeMedicalTool };
