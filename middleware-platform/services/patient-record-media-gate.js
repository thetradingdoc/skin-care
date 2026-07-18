'use strict';

/**
 * Medical-tracker upload media gate — photo|pdf only.
 * Rejects DICOM, video, and zip/archive containers at gate + capture.
 * Product path: save the radiology *report* (PDF/photo), not raw imaging packages.
 */

const MEDIA_TYPES = Object.freeze(['photo', 'pdf']);

const PDF_MAGIC = Buffer.from('%PDF-');
const PDF_MAGIC_WINDOW = 1024;

/**
 * True when `%PDF-` appears within the first 1KB (PDF allows leading garbage).
 * Do not trust filename / declared MIME alone for text-layer / meter routing.
 */
function bufferHasPdfMagic(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 5) return false;
  const window = buffer.slice(0, Math.min(buffer.length, PDF_MAGIC_WINDOW));
  return window.indexOf(PDF_MAGIC) !== -1;
}

function looksLikeDicom({ buffer, mimeType, fileName }) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (mime.includes('dicom') || name.endsWith('.dcm') || name.endsWith('.dicom')) return true;
  // DICOM Part 10: "DICM" at byte offset 128
  if (buffer && Buffer.isBuffer(buffer) && buffer.length >= 132) {
    if (buffer.slice(128, 132).toString('ascii') === 'DICM') return true;
  }
  return false;
}

function looksLikeVideo({ mimeType, fileName }) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  if (/\.(mp4|mov|m4v|avi|mkv|webm|3gp)$/i.test(name)) return true;
  return false;
}

function looksLikeZipArchive({ buffer, mimeType, fileName }) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  if (
    mime.includes('zip') ||
    mime.includes('x-rar') ||
    mime.includes('x-7z') ||
    mime === 'application/x-tar' ||
    mime === 'application/gzip'
  ) {
    return true;
  }
  if (/\.(zip|rar|7z|tar|gz|tgz)$/i.test(name)) return true;
  // ZIP local file header
  if (
    buffer &&
    Buffer.isBuffer(buffer) &&
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return true;
  }
  return false;
}

/**
 * @returns {null | { ok: false, status: number, error: string, error_code: string, message: string, manual_allowed: boolean }}
 */
function assertMedicalUploadAllowed({ buffer = null, mimeType = null, fileName = null } = {}) {
  if (looksLikeDicom({ buffer, mimeType, fileName })) {
    return {
      ok: false,
      status: 400,
      error: 'MEDIA_TYPE_DICOM_NOT_SUPPORTED',
      error_code: 'MEDIA_TYPE_DICOM_NOT_SUPPORTED',
      message:
        'Raw imaging files (DICOM) are not supported. Save the radiology report as a PDF or a photo of the page — not the imaging package.',
      manual_allowed: true,
      allowed: MEDIA_TYPES,
    };
  }
  if (looksLikeVideo({ mimeType, fileName })) {
    return {
      ok: false,
      status: 400,
      error: 'MEDIA_TYPE_VIDEO_NOT_SUPPORTED',
      error_code: 'MEDIA_TYPE_VIDEO_NOT_SUPPORTED',
      message: 'Video is not supported. Use a photo or PDF of the document or skin area.',
      manual_allowed: true,
      allowed: MEDIA_TYPES,
    };
  }
  if (looksLikeZipArchive({ buffer, mimeType, fileName })) {
    return {
      ok: false,
      status: 400,
      error: 'MEDIA_TYPE_ZIP_NOT_SUPPORTED',
      error_code: 'MEDIA_TYPE_ZIP_NOT_SUPPORTED',
      message:
        'Compressed packages are not supported. Upload the report PDF or a photo of the page — not a zip of imaging files.',
      manual_allowed: true,
      allowed: MEDIA_TYPES,
    };
  }

  // Declared PDF / .pdf extension without real magic → reject (catches PE renamed .pdf before AV)
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();
  const claimsPdf = mime.includes('pdf') || name.endsWith('.pdf');
  if (claimsPdf && buffer && Buffer.isBuffer(buffer) && buffer.length >= 5 && !bufferHasPdfMagic(buffer)) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_PDF_MAGIC',
      error_code: 'INVALID_PDF_MAGIC',
      message:
        'This file is named or typed as a PDF but is not a valid PDF. Upload a real PDF report or a photo.',
      manual_allowed: true,
      allowed: MEDIA_TYPES,
    };
  }

  return null;
}

/**
 * Whether capture should treat bytes as PDF for text-layer / meter routing.
 * Magic wins; mime/filename alone are insufficient.
 */
function isPdfForCaptureRouting({ buffer, mimeType, fileName } = {}) {
  if (buffer && Buffer.isBuffer(buffer) && bufferHasPdfMagic(buffer)) return true;
  // No buffer (hints-only) — cannot claim PDF path
  return false;
}

module.exports = {
  MEDIA_TYPES,
  PDF_MAGIC_WINDOW,
  bufferHasPdfMagic,
  isPdfForCaptureRouting,
  assertMedicalUploadAllowed,
  looksLikeDicom,
  looksLikeVideo,
  looksLikeZipArchive,
};
