'use strict';

/**
 * P3.04 / P3.05 — Perception: skin vision + document OCR.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

async function perceiveSkinVision(buffer, mimeType) {
  const faceReadVision = require('../face-read-vision');
  if (typeof faceReadVision.analyzeWithVision !== 'function') {
    return { ok: false, reason: 'vision_unavailable', vision: null };
  }
  // When FACE_READ_VISION_ENABLED is off, analyzeWithVision may no-op — still call
  const vision = await faceReadVision.analyzeWithVision(buffer, mimeType || 'image/jpeg');
  return { ok: true, vision: vision || null };
}

async function perceiveDocOcr({ buffer, mimeType, fileName }) {
  const extraction = require('../patient-document-extraction');
  const { bufferHasPdfMagic } = require('../patient-record-media-gate');
  let tmpPath = null;
  try {
    const mime = String(mimeType || '').toLowerCase();
    // Route as PDF only when magic confirms — not filename/MIME alone
    if (bufferHasPdfMagic(buffer)) {
      const result = await extraction.extractText({
        buffer,
        mimeType: mime.includes('pdf') ? mime : 'application/pdf',
        fileName,
      });
      return {
        ok: true,
        text: String(result?.text || '').trim(),
        method: result?.method || 'pdf-parse',
        used_ai: result?.used_ai === true,
        text_layer: result?.text_layer || null,
      };
    }

    // extractFromImage needs a path — write temp file
    tmpPath = path.join(
      os.tmpdir(),
      `touche-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    );
    fs.writeFileSync(tmpPath, buffer);
    const result = await extraction.extractText({
      storagePath: tmpPath,
      buffer,
      mimeType: mime || 'image/jpeg',
      fileName,
    });
    return {
      ok: true,
      text: String(result?.text || '').trim(),
      method: result?.method || 'vision',
      used_ai: result?.used_ai !== false,
      text_layer: null,
    };
  } catch (e) {
    return { ok: false, text: '', method: 'error', error: e.message, used_ai: false };
  } finally {
    if (tmpPath) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
    }
  }
}

module.exports = { perceiveSkinVision, perceiveDocOcr };
