'use strict';

/**
 * P4.10–P4.12 — Medical-tracker product safety policy.
 * Used by compose graphs and executor; tests treat these as hard boundaries.
 */

/** Fixture list of disallowed diagnosis / clinical directive patterns (P4.10). */
const DIAGNOSIS_PATTERNS = [
  /\byou have\b/i,
  /\bthis looks like\b/i,
  /\bdiagnos(e|is|ed|ing)\b/i,
  /\bmalignant\b/i,
  /\bmelanoma\b/i,
  /\bcarcinoma\b/i,
  /\beczema\b/i,
  /\bpsoriasis\b/i,
  /\brosacea\b/i,
  /\binfection\b/i,
  /\bprescribe\b/i,
  /\byou should (stop|start|take|use) (this|that|the) (drug|medication|steroid)\b/i,
  /\bclinical (directive|order)\b/i,
  /\bpatholog(y|ical)\b/i,
  /\blesion\b/i,
  /\bdisease\b/i,
];

const COMMERCE_KEYS = [
  'commerce_variant_id',
  'variant_id',
  'shopify_variant_id',
  'purchase_url',
  'buy_url',
  'product_handle',
  'checkout_url',
];

/** CF-1 — Keys that must never appear on persisted medical structured_json (positive schema lock). */
const FORBIDDEN_CLINICAL_KEYS = Object.freeze([
  'diagnosis',
  'diagnoses',
  'condition',
  'conditions',
  'disease',
  'disease_name',
  'icd',
  'icd10',
  'icd_code',
  'dx',
  'differential',
  'pathology',
]);

/** CF-1 — ai_suggestion may only carry these keys. */
const AI_SUGGESTION_ALLOWED_KEYS = Object.freeze([
  'delta',
  'text',
  'source',
  'labeled',
  'not_diagnosis',
  'prior_used',
]);

/** CF-1 — closed enum for delta (positive constraint, not denylist). */
const AI_DELTA_ENUM = Object.freeze(['baseline', 'worse', 'same', 'calmer']);

/**
 * CF-1 — Positive allowlist for AI suggestion prose.
 * Free-text exposure was always note / ai_suggestion.text, not delta.
 * AI text must match a closed template for its delta — inventing clinical prose fails.
 */
const AI_SUGGESTION_TEXT_BY_DELTA = Object.freeze({
  baseline: Object.freeze([
    'This is your baseline skin log — future checks can compare against it.',
  ]),
  calmer: Object.freeze(['Compared with your last skin note, today looks calmer.']),
  worse: Object.freeze(['Compared with your last skin note, today looks more active.']),
  same: Object.freeze(['Compared with your last skin note, today looks about the same.']),
});

/** Condition / clinical nouns banned as whole words in free-text fields (note, AI text). */
const FREE_TEXT_CONDITION_FIXTURES = Object.freeze([
  'dermatitis',
  'atopic',
  'eczema',
  'psoriasis',
  'rosacea',
  'melanoma',
  'carcinoma',
  'vitiligo',
  'keratosis',
  'cellulitis',
  'impetigo',
  'lupus',
  'urticaria',
  'hives',
  'acne vulgaris',
  'seborrheic',
  'fungal infection',
  'bacterial infection',
  'malignancy',
  'malignant',
  'benign neoplasm',
  'diagnosis',
  'diagnosed',
  'pathology',
  'biopsy-proven',
]);

/** Clinical assertion phrasing that games the older keyword list. */
const FREE_TEXT_CLINICAL_ASSERTION_PATTERNS = Object.freeze([
  /\bconsistent with\b/i,
  /\bsuggestive of\b/i,
  /\bappears to be\b/i,
  /\bthis (is|looks|seems) (like|to be)\b/i,
  /\blikely\s+(has|have|is)\b/i,
  /\bcompatible with\b/i,
  /\bdifferential\b/i,
  /\bicd-?10?\b/i,
  /\b[A-TV-Z][0-9]{2}(?:\.[0-9A-TV-Z]{1,4})?\b/, // ICD-ish codes
]);

const FREE_TEXT_FIELDS = Object.freeze([
  'note',
  'label',
  'title',
  'free_text',
  'free_text_facts',
  'body_area',
  'body_location',
  'findings',
  'conclusion',
  'external_images_note',
  'study_type',
  'facility',
  'body_region',
]);

/**
 * Fields that quote the user's uploaded document (PDF/OCR), not touche-generated prose.
 * Diagnosis vocabulary must NOT scrub these — a real radiology report may contain
 * physician diagnostic language. Touche AI output (ai_suggestion, interpretive notes)
 * remains fully gated.
 */
const DOCUMENT_SOURCED_FIELDS = Object.freeze([
  'findings',
  'conclusion',
  'impression',
  'external_images_note',
  'free_text',
  'raw_extract_text',
]);

/** Imaging quote fields — exempt only with server-trusted provenance (never lab_kind alone). */
const IMAGING_QUOTE_FIELDS = Object.freeze([
  'findings',
  'conclusion',
  'impression',
  'external_images_note',
]);

/**
 * Resolve provenance map that policy may trust.
 * Client-supplied structured.field_provenance is NEVER trusted unless the caller
 * explicitly passes opts.trustedProvenance (server-stamped / recomputed).
 */
function resolveTrustedProvenance(structured, opts = {}) {
  if (opts.trustedProvenance !== undefined) {
    const p = opts.trustedProvenance;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
    return p;
  }
  return null;
}

/**
 * Document-sourced exemption: only fields listed in trustedProvenance as 'document'.
 * lab_kind === imaging_report alone is NOT enough (client can forge it).
 */
function isDocumentSourcedField(structured, field, opts = {}) {
  if (!field) return false;
  const prov = resolveTrustedProvenance(structured, opts);
  if (prov && typeof prov === 'object' && prov[field] === 'document') return true;
  return false;
}

/**
 * Build a copy of structured_json for vocab scanning with document-sourced fields omitted.
 */
function omitDocumentSourcedForVocab(structured, opts = {}) {
  if (!structured || typeof structured !== 'object') return structured;
  const out = { ...structured };
  const prov = resolveTrustedProvenance(structured, opts) || {};
  for (const field of Object.keys(out)) {
    if (field === 'field_provenance' || field === 'ai_suggestion') continue;
    if (isDocumentSourcedField(out, field, opts) || prov[field] === 'document') {
      delete out[field];
    }
  }
  // Never drop ai_suggestion from the scrub payload — that is touche-generated
  return out;
}

/**
 * Strip any client-asserted field_provenance (always recompute server-side).
 */
function stripClientFieldProvenance(structured) {
  if (!structured || typeof structured !== 'object') return structured;
  const out = { ...structured };
  delete out.field_provenance;
  return out;
}

/**
 * Recompute trusted document provenance on confirm from the stored fact.
 * Only carries forward fields that were already document-sourced at create AND
 * whose values are unchanged (still the extract quote). Imaging Findings/Conclusion
 * additionally require the stored fact to already be lab + imaging_report.
 */
function recomputeTrustedFieldProvenance(existing, incoming) {
  const prev =
    existing?.structured_json && typeof existing.structured_json === 'object'
      ? existing.structured_json
      : {};
  const prevProv =
    prev.field_provenance && typeof prev.field_provenance === 'object' && !Array.isArray(prev.field_provenance)
      ? prev.field_provenance
      : {};
  const trusted = {};
  const tag = String(existing?.tag || '');

  for (const [field, kind] of Object.entries(prevProv)) {
    if (kind !== 'document') continue;
    if (incoming?.[field] == null) continue;
    if (String(incoming[field]) === String(prev[field] ?? '')) {
      trusted[field] = 'document';
    }
  }

  // Imaging: server-confirmed extract on the stored fact (not client-asserted lab_kind)
  if (tag === 'lab' && String(prev.lab_kind || '') === 'imaging_report') {
    for (const field of IMAGING_QUOTE_FIELDS) {
      if (trusted[field]) continue;
      if (prev[field] == null || incoming?.[field] == null) continue;
      if (String(incoming[field]) !== String(prev[field])) continue;
      // Unchanged quote from a server-created imaging report
      if (prevProv[field] === 'document' || prevProv.findings === 'document' || prevProv.conclusion === 'document') {
        trusted[field] = 'document';
      } else if (prev.findings != null || prev.conclusion != null) {
        // Pre-provenance imaging rows: value unchanged from stored extract
        trusted[field] = 'document';
      }
    }
  }

  return Object.keys(trusted).length ? trusted : null;
}

/**
 * Confirm-path gate: strip client provenance, recompute trusted map, run persist policy.
 * @returns {{ ok: true, structured: object } | { ok: false, policy: object }}
 */
function prepareConfirmStructuredForPersist(existing, incomingNormalized) {
  const stripped = stripClientFieldProvenance(incomingNormalized || {});
  const trusted = recomputeTrustedFieldProvenance(existing, stripped);
  const structured = {
    ...stripped,
    field_provenance: trusted,
  };
  const tag = String(existing?.tag || '');
  const policy = assertOrchestrationPersistPolicy(tag, structured, {
    trustedProvenance: trusted,
  });
  if (!policy.ok) return { ok: false, policy, structured };
  return { ok: true, structured, policy };
}

function assertAiSuggestionTextAllowlisted(sug) {
  if (!sug || typeof sug !== 'object') return { ok: true };
  const text = sug.text == null ? '' : String(sug.text).trim();
  if (!text) return { ok: true };
  const delta = sug.delta != null ? String(sug.delta) : null;
  if (!delta || !AI_DELTA_ENUM.includes(delta)) {
    // delta enum check happens elsewhere; without valid delta, no free AI prose allowed
    return {
      ok: false,
      error_code: 'AI_TEXT_REQUIRES_DELTA',
      message: 'ai_suggestion.text requires a valid delta and must match a closed template',
    };
  }
  const allowed = AI_SUGGESTION_TEXT_BY_DELTA[delta] || [];
  if (!allowed.includes(text)) {
    return {
      ok: false,
      error_code: 'AI_TEXT_NOT_ALLOWLISTED',
      message: 'ai_suggestion.text must match the closed template for its delta — free clinical prose forbidden',
      delta,
    };
  }
  return { ok: true };
}

/**
 * CF-1 free-text gate — applies to note / ai_suggestion.text (the real exposure),
 * not merely to the delta enum.
 */
function assertFreeTextClinicallySafe(field, text) {
  if (text == null || text === '') return { ok: true };
  const s = String(text);
  const matches = [];
  for (const re of FREE_TEXT_CLINICAL_ASSERTION_PATTERNS) {
    const m = s.match(re);
    if (m) matches.push(m[0]);
  }
  for (const term of FREE_TEXT_CONDITION_FIXTURES) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(s)) matches.push(term);
  }
  // Also run original diagnosis patterns on this field alone
  const vocab = assertNoDiagnosisVocabulary(s);
  if (!vocab.ok) matches.push(...vocab.matches);
  if (matches.length) {
    return {
      ok: false,
      error_code: 'FREE_TEXT_CLINICAL_CONTENT',
      field,
      matches: [...new Set(matches)],
      message: `Free-text field "${field}" contains clinical/diagnosis content`,
    };
  }
  return { ok: true };
}

function assertStructuredFreeTextFields(structured) {
  for (const field of FREE_TEXT_FIELDS) {
    if (typeof structured[field] === 'string') {
      if (isDocumentSourcedField(structured, field)) continue;
      const r = assertFreeTextClinicallySafe(field, structured[field]);
      if (!r.ok) return r;
    }
  }
  if (structured.ai_suggestion && typeof structured.ai_suggestion === 'object') {
    const tpl = assertAiSuggestionTextAllowlisted(structured.ai_suggestion);
    if (!tpl.ok) return tpl;
    // Even allowlisted templates are re-checked; custom text already rejected above
    if (structured.ai_suggestion.text) {
      // Allowlisted templates are product copy — skip condition fixtures on exact template match
      const delta = structured.ai_suggestion.delta;
      const allowed = (delta && AI_SUGGESTION_TEXT_BY_DELTA[delta]) || [];
      if (!allowed.includes(String(structured.ai_suggestion.text).trim())) {
        const r = assertFreeTextClinicallySafe('ai_suggestion.text', structured.ai_suggestion.text);
        if (!r.ok) return r;
      }
    }
  }
  return { ok: true };
}

/**
 * CF-1 second layer: positive structural constraints on structured_json.
 * - Forbid diagnosis-shaped keys
 * - Closed delta enum
 * - Closed AI text templates (positive allowlist on ai_suggestion.text)
 * - Free-text note/label/… clinical-content rejection (the actual exposure surface)
 */
function assertPositiveMedicalTextShape(structured) {
  if (!structured || typeof structured !== 'object') {
    return { ok: false, error_code: 'STRUCTURED_REQUIRED', message: 'structured_json required' };
  }

  const foundKeys = FORBIDDEN_CLINICAL_KEYS.filter((k) =>
    Object.prototype.hasOwnProperty.call(structured, k),
  );
  if (foundKeys.length) {
    return {
      ok: false,
      error_code: 'FORBIDDEN_CLINICAL_KEY',
      keys: foundKeys,
      message: `Structured facts cannot carry clinical/diagnosis keys: ${foundKeys.join(', ')}`,
    };
  }

  // Nested scan one level (ai_suggestion, results)
  for (const [k, v] of Object.entries(structured)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const nested = FORBIDDEN_CLINICAL_KEYS.filter((fk) =>
        Object.prototype.hasOwnProperty.call(v, fk),
      );
      if (nested.length) {
        return {
          ok: false,
          error_code: 'FORBIDDEN_CLINICAL_KEY',
          keys: nested.map((n) => `${k}.${n}`),
          message: `Nested clinical keys forbidden under ${k}`,
        };
      }
    }
  }

  const sug = structured.ai_suggestion;
  if (sug != null) {
    if (typeof sug !== 'object' || Array.isArray(sug)) {
      return {
        ok: false,
        error_code: 'AI_SUGGESTION_MUST_BE_OBJECT',
        message: 'ai_suggestion must be object or null',
      };
    }
    const extra = Object.keys(sug).filter((k) => !AI_SUGGESTION_ALLOWED_KEYS.includes(k));
    if (extra.length) {
      return {
        ok: false,
        error_code: 'AI_SUGGESTION_SCHEMA',
        keys: extra,
        message: `ai_suggestion has non-allowlisted keys: ${extra.join(', ')}`,
      };
    }
    if (sug.delta != null && !AI_DELTA_ENUM.includes(String(sug.delta))) {
      return {
        ok: false,
        error_code: 'AI_DELTA_ENUM',
        message: `ai_suggestion.delta must be one of ${AI_DELTA_ENUM.join('|')}`,
        delta: sug.delta,
      };
    }
    if (sug.not_diagnosis === false) {
      return {
        ok: false,
        error_code: 'NOT_DIAGNOSIS_FLAG_REQUIRED',
        message: 'ai_suggestion.not_diagnosis must not be false',
      };
    }
  }

  const freeText = assertStructuredFreeTextFields(structured);
  if (!freeText.ok) return freeText;

  return { ok: true };
}

/**
 * Combined persist gate: denylist + positive shape (CF-1).
 */
function assertVisualPointerOnStructured(structured) {
  if (!structured || typeof structured !== 'object') return { ok: true };
  if (!Object.prototype.hasOwnProperty.call(structured, 'visual_pointer')) return { ok: true };
  const { assertVisualPointerShape } = require('./visual-observation-pointer');
  return assertVisualPointerShape(structured.visual_pointer);
}

function assertSafeToPersistStructured(structured, opts = {}) {
  const shape = assertPositiveMedicalTextShape(structured);
  if (!shape.ok) return shape;
  const vocab = assertNoDiagnosisVocabulary(omitDocumentSourcedForVocab(structured, opts));
  if (!vocab.ok) {
    return {
      ok: false,
      error_code: 'DIAGNOSIS_VOCABULARY',
      matches: vocab.matches,
      message: 'Diagnosis vocabulary rejected',
    };
  }
  const aiShape = assertAiSuggestionShape(structured);
  if (!aiShape.ok) return aiShape;
  const pointer = assertVisualPointerOnStructured(structured);
  if (!pointer.ok) return pointer;
  return { ok: true };
}

/**
 * Persist gate for canonical `orchestrateCapture` (HTTP capture path).
 *
 * Product decision (2026-07-16 / updated 2026-07-17):
 * - Vision/OCR free prose is allowed when labeled (`labeled: 'ai_suggestion'`) —
 *   NOT forced into closed delta templates.
 * - Touche-GENERATED free text (notes, ai_suggestion) must pass
 *   `assertNoDiagnosisVocabulary` / free-text clinical scrub — fail closed.
 * - DOCUMENT-SOURCED verbatim fields are exempt only when listed in
 *   `opts.trustedProvenance` as 'document' (server-stamped / recomputed).
 *   Never trust client-supplied `field_provenance`. Imaging Findings/Conclusion
 *   require lab_kind imaging_report on the *stored* fact plus trusted provenance
 *   (see `recomputeTrustedFieldProvenance`).
 * - When `ai_suggestion.delta` is set (delta-compose style), also enforce
 *   `assertAiSuggestionTextAllowlisted`.
 * - Prescription commerce: `assertNoCommerceOnPrescription` (policy layer),
 *   independent of P2.04 schema validators.
 *
 * @param {string} tag
 * @param {object} structured
 * @param {{ trustedProvenance?: object|null }} [opts]
 */
function assertOrchestrationPersistPolicy(tag, structured, opts = {}) {
  if (!structured || typeof structured !== 'object') {
    return {
      ok: false,
      error_code: 'STRUCTURED_REQUIRED',
      message: 'structured_json required before persist',
    };
  }

  const policyOpts = {
    trustedProvenance: opts.trustedProvenance !== undefined ? opts.trustedProvenance : null,
  };

  const aiShape = assertAiSuggestionShape(structured);
  if (!aiShape.ok) return aiShape;

  const pointer = assertVisualPointerOnStructured(structured);
  if (!pointer.ok) return pointer;

  if (String(tag) === 'prescription') {
    const commerce = assertNoCommerceOnPrescription(structured);
    if (!commerce.ok) return commerce;
  }

  // Diagnosis vocab on touche-generated / user-typed fields only — omit document quotes
  const vocabTarget = omitDocumentSourcedForVocab(structured, policyOpts);
  const vocab = assertNoDiagnosisVocabulary(vocabTarget);
  if (!vocab.ok) {
    return {
      ok: false,
      error_code: 'DIAGNOSIS_VOCABULARY',
      matches: vocab.matches,
      message: 'Diagnosis vocabulary rejected — retake or enter manually',
      action: 'retake',
      vision_fail: true,
    };
  }

  // Per-field free-text scrub — skip document-sourced verbatim extraction
  for (const field of FREE_TEXT_FIELDS) {
    if (typeof structured[field] === 'string' && structured[field]) {
      if (isDocumentSourcedField(structured, field, policyOpts)) continue;
      const r = assertFreeTextClinicallySafe(field, structured[field]);
      if (!r.ok) {
        return {
          ...r,
          error_code: 'DIAGNOSIS_VOCABULARY',
          action: 'retake',
          vision_fail: true,
        };
      }
    }
  }

  const sug = structured.ai_suggestion;
  if (sug != null && typeof sug === 'object' && !Array.isArray(sug)) {
    if (sug.labeled !== 'ai_suggestion') {
      return {
        ok: false,
        error_code: 'AI_SUGGESTION_LABEL_REQUIRED',
        message: 'ai_suggestion must set labeled: "ai_suggestion"',
        action: 'retake',
        vision_fail: true,
      };
    }
    if (sug.not_diagnosis === false) {
      return {
        ok: false,
        error_code: 'NOT_DIAGNOSIS_FLAG_REQUIRED',
        message: 'ai_suggestion.not_diagnosis must not be false',
        action: 'retake',
        vision_fail: true,
      };
    }

    // Delta path → closed templates (assertAiSuggestionTextAllowlisted).
    // Free-prose path (no delta) → scrub only; do not force templates.
    if (sug.delta != null) {
      const allow = assertAiSuggestionTextAllowlisted(sug);
      if (!allow.ok) {
        return { ...allow, action: 'retake', vision_fail: true };
      }
    } else if (sug.text) {
      const textSafe = assertFreeTextClinicallySafe('ai_suggestion.text', sug.text);
      if (!textSafe.ok) {
        return {
          ...textSafe,
          error_code: 'DIAGNOSIS_VOCABULARY',
          action: 'retake',
          vision_fail: true,
        };
      }
    }
  }

  return { ok: true };
}

function assertNoDiagnosisVocabulary(textOrObj) {
  const text = typeof textOrObj === 'string' ? textOrObj : JSON.stringify(textOrObj || {});
  const matches = [];
  for (const re of DIAGNOSIS_PATTERNS) {
    const m = text.match(re);
    if (m) matches.push(m[0]);
  }
  if (!matches.length) {
    return { ok: true, matches: [], clean_text: text };
  }
  // For extract paths we still return cleaned text with matches redacted for safety
  let clean = text;
  for (const re of DIAGNOSIS_PATTERNS) {
    clean = clean.replace(re, '[redacted]');
  }
  return { ok: false, matches, clean_text: clean };
}

/**
 * P4.11 — ai_suggestion must be a distinct object field (or null).
 * User-confirmed fields (note, body_area, drug, amount, …) must not contain
 * an embedded "ai:" prefix blend or overwrite from suggestion text.
 */
function assertAiSuggestionShape(structured) {
  if (!structured || typeof structured !== 'object') {
    return { ok: false, error_code: 'STRUCTURED_REQUIRED', message: 'structured_json required' };
  }
  if (!Object.prototype.hasOwnProperty.call(structured, 'ai_suggestion')) {
    // Missing key is ok if we treat as null — normalize callers should set it.
    // Require explicit key for skin/delta outputs that carry AI.
  }
  const sug = structured.ai_suggestion;
  if (sug != null) {
    if (typeof sug !== 'object' || Array.isArray(sug)) {
      return {
        ok: false,
        error_code: 'AI_SUGGESTION_MUST_BE_OBJECT',
        message: 'ai_suggestion must be an object or null — never a bare string blended into note',
      };
    }
    if (sug.source_field || sug.blended_into) {
      return {
        ok: false,
        error_code: 'AI_SUGGESTION_BLENDED',
        message: 'ai_suggestion must not declare blending into user fields',
      };
    }
  }
  // Detect blended shapes: note/body_area containing "AI SUGGESTS" as the value itself
  for (const key of ['note', 'body_area', 'label', 'drug', 'title']) {
    const v = structured[key];
    if (typeof v === 'string' && /\bAI\s*SUGGESTS\b/i.test(v)) {
      return {
        ok: false,
        error_code: 'AI_BLENDED_INTO_USER_FIELD',
        message: `User field "${key}" must not contain AI SUGGESTS text`,
      };
    }
  }
  return { ok: true };
}

/**
 * P4.12 — Prescription facts never carry commerce/purchase attachments.
 */
function stripCommerceFromPrescription(tag, structured) {
  if (!structured || typeof structured !== 'object') return structured;
  const out = { ...structured };
  if (String(tag) === 'prescription') {
    for (const k of COMMERCE_KEYS) {
      if (k in out) delete out[k];
    }
    if (out.ai_suggestion && typeof out.ai_suggestion === 'object') {
      const sug = { ...out.ai_suggestion };
      for (const k of COMMERCE_KEYS) {
        if (k in sug) delete sug[k];
      }
      out.ai_suggestion = sug;
    }
  }
  return out;
}

function assertNoCommerceOnPrescription(structured) {
  if (!structured || typeof structured !== 'object') {
    return { ok: true };
  }
  const found = COMMERCE_KEYS.filter((k) => structured[k] != null && structured[k] !== '');
  if (found.length) {
    return {
      ok: false,
      error_code: 'PRESCRIPTION_COMMERCE_FORBIDDEN',
      keys: found,
      message: `Prescription facts cannot carry commerce fields: ${found.join(', ')}`,
    };
  }
  return { ok: true };
}

function priorIsEmpty(prior) {
  if (!prior || typeof prior !== 'object') return true;
  const keys = Object.keys(prior).filter((k) => {
    const v = prior[k];
    return v != null && v !== '' && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  });
  return keys.length === 0;
}

/**
 * Heuristic skin delta → always returns ai_suggestion object (never mutates user fields).
 * First-ever skin log (no prior fact) → delta: 'baseline' (5b-skin style), never a fake worse/same/calmer.
 */
function buildSkinDeltaSuggestion({ prior = {}, today = {} } = {}) {
  if (priorIsEmpty(prior)) {
    return {
      delta: 'baseline',
      text: 'This is your baseline skin log — future checks can compare against it.',
      source: 'delta_compose',
      labeled: 'ai_suggestion',
      not_diagnosis: true,
      prior_used: false,
    };
  }

  const priorNote = String(prior.note || prior.ai_suggestion?.text || '').toLowerCase();
  const todayNote = String(today.note || today.ai_suggestion?.text || '').toLowerCase();
  const worseHints = /\b(worse|angrier|more|flaring|spread)\b/;
  const calmerHints = /\b(calmer|better|faded|less|improved|settled)\b/;

  let delta = 'same';
  if (calmerHints.test(todayNote) && !worseHints.test(todayNote)) delta = 'calmer';
  else if (worseHints.test(todayNote)) delta = 'worse';
  else if (priorNote && todayNote && todayNote.length > priorNote.length + 20) delta = 'worse';

  const text =
    delta === 'calmer'
      ? 'Compared with your last skin note, today looks calmer.'
      : delta === 'worse'
        ? 'Compared with your last skin note, today looks more active.'
        : 'Compared with your last skin note, today looks about the same.';

  return {
    delta, // worse | same | calmer | baseline
    text,
    source: 'delta_compose',
    labeled: 'ai_suggestion',
    not_diagnosis: true,
    prior_used: true,
  };
}

module.exports = {
  DIAGNOSIS_PATTERNS,
  COMMERCE_KEYS,
  FORBIDDEN_CLINICAL_KEYS,
  AI_SUGGESTION_ALLOWED_KEYS,
  AI_DELTA_ENUM,
  AI_SUGGESTION_TEXT_BY_DELTA,
  FREE_TEXT_CONDITION_FIXTURES,
  FREE_TEXT_CLINICAL_ASSERTION_PATTERNS,
  FREE_TEXT_FIELDS,
  DOCUMENT_SOURCED_FIELDS,
  IMAGING_QUOTE_FIELDS,
  isDocumentSourcedField,
  omitDocumentSourcedForVocab,
  stripClientFieldProvenance,
  recomputeTrustedFieldProvenance,
  prepareConfirmStructuredForPersist,
  resolveTrustedProvenance,
  assertNoDiagnosisVocabulary,
  assertAiSuggestionShape,
  assertPositiveMedicalTextShape,
  assertSafeToPersistStructured,
  assertOrchestrationPersistPolicy,
  assertFreeTextClinicallySafe,
  assertAiSuggestionTextAllowlisted,
  stripCommerceFromPrescription,
  assertNoCommerceOnPrescription,
  buildSkinDeltaSuggestion,
  assertVisualPointerOnStructured,
};
