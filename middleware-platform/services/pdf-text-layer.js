'use strict';

/**
 * PDF text-layer detection + extraction routing.
 * Prefer embedded text (pdf-parse) over vision OCR when the layer is usable.
 * Scanned PDFs (empty/near-empty text) fall back to embedded-image vision OCR.
 */

const MIN_USABLE_CHARS = 80;
const MIN_LETTER_RATIO = 0.35;

/**
 * @param {string} text
 * @returns {{ usable: boolean, reason: string, char_count: number, letter_ratio: number }}
 */
function assessPdfTextLayer(text) {
  const raw = String(text || '');
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  const char_count = trimmed.length;
  if (char_count < MIN_USABLE_CHARS) {
    return {
      usable: false,
      reason: 'too_short',
      char_count,
      letter_ratio: 0,
    };
  }
  const letters = (trimmed.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  const letter_ratio = letters / Math.max(1, char_count);
  if (letter_ratio < MIN_LETTER_RATIO) {
    return {
      usable: false,
      reason: 'low_letter_ratio',
      char_count,
      letter_ratio: Math.round(letter_ratio * 1000) / 1000,
    };
  }
  return {
    usable: true,
    reason: 'text_layer',
    char_count,
    letter_ratio: Math.round(letter_ratio * 1000) / 1000,
  };
}

/**
 * Best-effort: pull embedded JPEG streams from PDF bytes (common for scans).
 * @param {Buffer} buffer
 * @param {{ maxImages?: number }} [opts]
 * @returns {Buffer[]}
 */
function extractEmbeddedJpegBuffers(buffer, opts = {}) {
  const maxImages = opts.maxImages || 4;
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return [];
  const out = [];
  let i = 0;
  while (i < buffer.length - 1 && out.length < maxImages) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8) {
      let j = i + 2;
      while (j < buffer.length - 1) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          const slice = buffer.slice(i, j + 2);
          // Skip tiny icons
          if (slice.length >= 8 * 1024) out.push(slice);
          i = j + 2;
          break;
        }
        j += 1;
      }
      if (j >= buffer.length - 1) break;
    } else {
      i += 1;
    }
  }
  // Prefer larger images first
  out.sort((a, b) => b.length - a.length);
  return out.slice(0, maxImages);
}

module.exports = {
  assessPdfTextLayer,
  extractEmbeddedJpegBuffers,
  MIN_USABLE_CHARS,
  MIN_LETTER_RATIO,
};
