/**
 * Antivirus / content scanning for patient document uploads.
 *
 * Medical record uploads (capture orchestration): fail-closed.
 * - ClamAV must be configured (`CLAMAV_SOCKET` or `CLAMAV_BIN`).
 * - Heuristics alone are never sufficient for PHI uploads.
 * - ClamAV/scan errors reject the upload (no silent allow).
 *
 * Image/PDF heuristic note (2026-07-17):
 * Compressed image entropy and PDF-embedded JPEG streams frequently contain PE/ELF/`eval(`/`.exe `
 * byte sequences by chance. Those patterns are skipped when buffer magic is a known
 * compressed image or `%PDF-` (within first 1KB). script/javascript:/vbscript: heuristics
 * still run for every file type including PDFs — real attack vectors, not FP noise.
 * ClamAV remains the actual content scanner for every medical upload (including every PDF)
 * when configured; heuristics are a fast pre-filter only, never a ClamAV replacement.
 * See docs/security/UPLOAD_AND_AV.md.
 *
 * Local dev tradeoff: without ClamAV, medical uploads fail with AV_NOT_CONFIGURED.
 * Explicit non-production escape hatch only:
 *   PATIENT_RECORD_AV_DEV_BYPASS=1  (ignored when NODE_ENV=production)
 * That bypass is heuristic-only and logs a loud warning — not a silent weaken.
 *
 * Legacy non-medical callers may still use scanBuffer/scanFile with ENABLE_ANTIVIRUS_SCAN.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function isAvEnabled() {
  return (
    process.env.ENABLE_ANTIVIRUS_SCAN === '1' ||
    process.env.ENABLE_ANTIVIRUS_SCAN === 'true' ||
    process.env.PATIENT_RECORD_AV_SCAN === '1'
  );
}

function isClamAvConfigured() {
  return Boolean(
    (process.env.CLAMAV_SOCKET && String(process.env.CLAMAV_SOCKET).trim()) ||
      (process.env.CLAMAV_BIN && String(process.env.CLAMAV_BIN).trim()),
  );
}

function clamscanBin() {
  const bin = process.env.CLAMAV_BIN && String(process.env.CLAMAV_BIN).trim();
  return bin || 'clamscan';
}

/** Explicit non-prod bypass — never silent, never honored in production. */
function isPatientRecordDevBypass() {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') return false;
  return (
    process.env.PATIENT_RECORD_AV_DEV_BYPASS === '1' ||
    process.env.PATIENT_RECORD_AV_DEV_BYPASS === 'true'
  );
}

/**
 * True for JPEG / PNG / WebP / HEIC-HEIF family by magic bytes (not MIME spoofing).
 * These formats' compressed payloads false-trigger PE/ELF/eval/.exe substring heuristics.
 */
function isCompressedImageMagic(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  // JPEG SOI
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true;
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true;
  }
  // HEIC/HEIF ISO BMFF: size + ftyp + brand
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (/^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|avic)/i.test(brand)) return true;
  }
  return false;
}

/** PDF header within first 1KB — embedded JPEG streams hit MZ/ELF entropy false positives. */
function isPdfMagic(buffer) {
  const { bufferHasPdfMagic } = require('./patient-record-media-gate');
  return bufferHasPdfMagic(buffer);
}

/**
 * Patterns that false-trigger inside JPEG/HEIC/PDF-embedded entropy. Skipped for those magics.
 * A raw PE/ELF file still fails image/PDF magic (starts with MZ/ELF) → full set.
 */
const BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS = [
  /\x4d\x5a/, // PE MZ — common in JPEG entropy
  /\x7fELF/, // ELF
  /\.exe\s/i, // ".exe " substring
  /eval\s*\(/i, // "eval(" substring
];

/** Meaningful for HTML/script payloads; cheap; kept for all file types including images/PDFs. */
const SCRIPT_HEURISTIC_PATTERNS = [/script\s*[>=]|<script/i, /javascript:/i, /vbscript:/i];

/** Full set for octet-stream / unknown (unchanged coverage). */
const ALL_HEURISTIC_PATTERNS = [
  ...BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS,
  ...SCRIPT_HEURISTIC_PATTERNS,
];

/** @deprecated Alias — full pattern list (non-image path). Prefer ALL_HEURISTIC_PATTERNS. */
const SUSPICIOUS_PATTERNS = ALL_HEURISTIC_PATTERNS;

/**
 * @param {Buffer} slice - first up to 64KB
 * @param {{ fullBuffer?: Buffer }} [opts] - full buffer for image/PDF-magic decision
 */
function heuristicThreat(slice, opts = {}) {
  const full = opts.fullBuffer && Buffer.isBuffer(opts.fullBuffer) ? opts.fullBuffer : slice;
  const skipBinaryEntropy = isCompressedImageMagic(full) || isPdfMagic(full);
  const patterns = skipBinaryEntropy ? SCRIPT_HEURISTIC_PATTERNS : ALL_HEURISTIC_PATTERNS;

  for (const pat of patterns) {
    if (pat.test(slice)) {
      return {
        safe: false,
        error:
          'File blocked: content appears potentially harmful. Please upload only medical documents (PDF, images).',
        error_code: 'AV_HEURISTIC_BLOCKED',
      };
    }
  }
  return null;
}

async function scanWithClamAV(filePath) {
  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const exec = promisify(execFile);
    // maxBuffer must be large enough for clamscan banners/errors — 2KB falsely
    // surfaced as AV_UNAVAILABLE on every image once heuristics stopped short-circuiting.
    const args = ['--no-summary', '--infected', filePath];
    const dbDir = String(process.env.CLAMAV_DATABASE_DIR || '').trim();
    if (dbDir) args.unshift(`--database=${dbDir}`);
    await exec(clamscanBin(), args, { timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    return { safe: true };
  } catch (e) {
    const stdout = String(e.stdout || '');
    const stderr = String(e.stderr || '');
    const combined = `${stdout}\n${stderr}`;
    if (e.code === 1 && /FOUND/i.test(combined)) {
      return {
        safe: false,
        error:
          'File blocked: antivirus scan detected a threat. Please upload only medical documents.',
        error_code: 'AV_THREAT_FOUND',
      };
    }
    console.warn(
      '[antivirus] ClamAV error (fail-closed):',
      e?.message || e,
      `code=${e.code}`,
      stderr.slice(0, 500) || stdout.slice(0, 500),
    );
    return {
      safe: false,
      error: 'Antivirus scan unavailable. Upload rejected.',
      error_code: 'AV_UNAVAILABLE',
    };
  }
}

/**
 * Scan a file for malicious content (legacy portal path — still fail-closed when enabled).
 */
async function scanFile(filePath) {
  if (!isAvEnabled()) return { safe: true };

  if (!filePath || !fs.existsSync(filePath)) {
    return { safe: false, error: 'File not found for scanning', error_code: 'AV_NO_FILE' };
  }

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(65536);
    const read = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const slice = buf.slice(0, read);

    const heur = heuristicThreat(slice, { fullBuffer: slice });
    if (heur) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
      return heur;
    }

    if (!isClamAvConfigured()) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
      return {
        safe: false,
        error: 'Antivirus is not configured. Uploads require ClamAV.',
        error_code: 'AV_NOT_CONFIGURED',
      };
    }

    const clamResult = await scanWithClamAV(filePath);
    if (!clamResult.safe) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
      return clamResult;
    }

    return { safe: true };
  } catch (e) {
    console.warn('[antivirus] Scan error (fail-closed):', e?.message || e);
    return {
      safe: false,
      error: 'Antivirus scan failed. Upload rejected.',
      error_code: 'AV_SCAN_ERROR',
    };
  }
}

async function scanBuffer(buf) {
  if (!isAvEnabled()) return { safe: true };
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
    return { safe: false, error: 'No file data to scan', error_code: 'AV_NO_FILE' };
  }
  const tmpPath = path.join(os.tmpdir(), `avscan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    fs.writeFileSync(tmpPath, buf);
    return await scanFile(tmpPath);
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

/**
 * Medical / patient_record_facts uploads — always fail-closed.
 * Does not honor "AV disabled = allow"; missing ClamAV rejects unless DEV bypass.
 */
async function scanPatientRecordBuffer(buf) {
  if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
    return { safe: false, error: 'No file data to scan', error_code: 'AV_NO_FILE' };
  }

  const slice = buf.slice(0, Math.min(buf.length, 65536));

  if (!isClamAvConfigured()) {
    if (isPatientRecordDevBypass()) {
      console.warn(
        '[antivirus] PATIENT_RECORD_AV_DEV_BYPASS=1 — ClamAV missing; heuristic-only (non-production)',
      );
      const heur = heuristicThreat(slice, { fullBuffer: buf });
      if (heur) return heur;
      return { safe: true, bypass: 'dev_heuristic_only' };
    }
    return {
      safe: false,
      error:
        'Antivirus is not configured for medical uploads. Configure ClamAV (CLAMAV_SOCKET or CLAMAV_BIN).',
      error_code: 'AV_NOT_CONFIGURED',
    };
  }

  const tmpPath = path.join(
    os.tmpdir(),
    `avscan-med-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  try {
    fs.writeFileSync(tmpPath, buf);
    const heur = heuristicThreat(slice, { fullBuffer: buf });
    if (heur) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (_) {}
      return heur;
    }
    return await scanWithClamAV(tmpPath);
  } catch (e) {
    console.warn('[antivirus] Patient-record scan error (fail-closed):', e?.message || e);
    return {
      safe: false,
      error: 'Antivirus scan failed. Upload rejected.',
      error_code: 'AV_SCAN_ERROR',
    };
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch (_) {}
  }
}

module.exports = {
  scanFile,
  scanBuffer,
  scanPatientRecordBuffer,
  heuristicThreat,
  isCompressedImageMagic,
  isPdfMagic,
  isAvEnabled,
  isClamAvConfigured,
  isPatientRecordDevBypass,
  BINARY_ENTROPY_FALSE_POSITIVE_PATTERNS,
  SCRIPT_HEURISTIC_PATTERNS,
  ALL_HEURISTIC_PATTERNS,
  SUSPICIOUS_PATTERNS,
  get ENABLED() {
    return isAvEnabled();
  },
  BLOCKED_MESSAGE:
    'Your file could not be saved because it did not pass our security scan. Please upload only medical documents (PDF, JPEG, PNG).',
};
