'use strict';

/**
 * P8.07 — Shelf Ask / Learn LLM (policy-gated).
 * Same discipline as Phase 4 compose: no diagnosis vocabulary; labeled suggestion.
 */

const DIAGNOSIS_RE =
  /\b(diagnos(?:is|e|ed)|you have|cancer|melanoma|malignant|prescribe|take this for)\b/i;

function buildShelfAskLearnReply({ kind, productName, question } = {}) {
  const mode = kind === 'learn' ? 'learn' : 'ask';
  const name = String(productName || 'this product').trim();
  const q = String(question || '').trim();

  if (DIAGNOSIS_RE.test(q) || DIAGNOSIS_RE.test(name)) {
    return {
      ok: false,
      error_code: 'DIAGNOSIS_VOCABULARY',
      ai_suggestion: null,
    };
  }

  const text =
    mode === 'learn'
      ? `About ${name}: general ingredient context only — not a diagnosis or prescription.`
      : `On ${name}: ${q || 'general question'} — educational only; not medical advice.`;

  return {
    ok: true,
    ai_suggestion: {
      labeled: 'ai_suggestion',
      not_diagnosis: true,
      mode,
      text,
      product_name: name,
    },
  };
}

module.exports = { buildShelfAskLearnReply, DIAGNOSIS_RE };
