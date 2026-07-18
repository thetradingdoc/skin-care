'use strict';

/**
 * P8.06 — Lab translate AFTER English extract SSOT.
 * Translates already-stored lab text for display_language — does NOT re-run OCR
 * or invent a multilingual extraction pipeline.
 */

const DIAGNOSIS_RE =
  /\b(diagnos(?:is|e|ed)|cancer|melanoma|malignant|prescribe|prescription for)\b/i;

function translateLabDisplayText({
  sourceText,
  source_language = 'en',
  target_language,
} = {}) {
  const text = String(sourceText || '').trim();
  const target = String(target_language || '').trim().toLowerCase() || 'en';
  const source = String(source_language || 'en').trim().toLowerCase() || 'en';

  if (!text) {
    return { ok: false, error_code: 'LAB_TRANSLATE_EMPTY', translated_text: null };
  }
  if (DIAGNOSIS_RE.test(text)) {
    return { ok: false, error_code: 'DIAGNOSIS_VOCABULARY', translated_text: null };
  }

  // Same-language: return as stored (English-backend SSOT)
  if (target === source || target === 'en') {
    return {
      ok: true,
      translated_text: text,
      source_language: source,
      display_language: target,
      mode: 'passthrough_english_ssot',
      stub: true,
    };
  }

  // Deferred real MT — explicit stub that does not invent clinical meaning
  return {
    ok: true,
    translated_text: text,
    source_language: source,
    display_language: target,
    mode: 'deferred_mt_keeps_english_extract',
    stub: true,
    note: 'Translation of stored English extract is queued — extract pipeline stays English-first.',
  };
}

module.exports = { translateLabDisplayText, DIAGNOSIS_RE };
