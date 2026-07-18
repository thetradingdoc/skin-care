'use strict';

/**
 * P2.18 — Language detect stub (editable on confirm).
 * Heuristic only — not a real translation model.
 *
 * Supported detections: en, es, fr, zh, ja, ko.
 * Everything else falls back to en with “kept as written” honesty in the product.
 *
 * Ordering matters: Spanish is checked before French because shared Latin accents
 * (é/ó) previously mislabeled Spanish radiology reports as French.
 */

function detectLanguageStub(text) {
  const s = String(text || '').trim();
  if (!s) return { source_language: null, confidence: 0, stub: true };

  // Script-based (high confidence)
  if (/[\u4e00-\u9fff]/.test(s)) return { source_language: 'zh', confidence: 0.4, stub: true };
  if (/[\u3040-\u30ff]/.test(s)) return { source_language: 'ja', confidence: 0.4, stub: true };
  if (/[\uac00-\ud7af]/.test(s)) return { source_language: 'ko', confidence: 0.4, stub: true };

  // Spanish BEFORE French — ñ/¿/¡ and radiology/clinical Spanish markers beat accent-only guesses
  if (
    /[ñ¿¡]/i.test(s) ||
    /\b(conclusi[oó]n|hallazgos|resonancia|m[eé]dico|se\s+realizan|rodilla|ligamento|menisco|atentamente|fecha|estudio|paciente|imagenes|im[aá]genes)\b/i.test(
      s,
    ) ||
    (/\b(el|los|las|una|unos|unas|del|al)\b/i.test(s) && /[áéíóúñ]/i.test(s))
  ) {
    return { source_language: 'es', confidence: 0.45, stub: true };
  }

  // French: require distinctive signals — do NOT match on bare le/les/des/une (too much
  // overlap with Romance text and false-positive Spanish MRI as fr).
  if (
    /[œæ]/i.test(s) ||
    /\b(fran[cç]ais|aujourd['’]?hui|s['’]il\s+vous\s+pla[iî]t|r[eé]sultats|monsieur|madame|bonjour|merci)\b/i.test(
      s,
    ) ||
    (/\b(dans|avec|chez)\b/i.test(s) &&
      /\b(le|les|une|des)\b/i.test(s) &&
      !/\b(el|los|las|una|unos|del|al|paciente|hallazgos)\b/i.test(s))
  ) {
    return { source_language: 'fr', confidence: 0.4, stub: true };
  }

  // Weaker Spanish fallback (articles + accents without ñ)
  if (/[áéíóú]/i.test(s) && /\b(el|la|los|las|una|paciente)\b/i.test(s)) {
    return { source_language: 'es', confidence: 0.3, stub: true };
  }

  return { source_language: 'en', confidence: 0.2, stub: true };
}

module.exports = { detectLanguageStub };
