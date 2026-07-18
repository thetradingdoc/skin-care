'use strict';

/**
 * P3.03 — Lightweight quality gate before metered AI.
 * Uses buffer size heuristics + optional laplacian if metadata provided.
 * Failures must not consume meter (caller gates AI after this).
 */

function assessCaptureQuality({ buffer = null, mimeType = null, tag = null, meta = null } = {}) {
  const issues = [];
  let score = 0.75;

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      ok: false,
      action: 'retake',
      quality_score: 0,
      quality_band: 'poor',
      quality_issues: ['no_media'],
      message: 'No image or document bytes received. Retake or upload again.',
    };
  }

  const size = buffer.length;
  if (size < 800) {
    issues.push('too_small');
    score -= 0.5;
  } else if (size < 4000) {
    issues.push('low_detail');
    score -= 0.2;
  }

  const mime = String(mimeType || '').toLowerCase();
  if (tag === 'skin' || tag === 'mark') {
    if (mime && !mime.startsWith('image/')) {
      issues.push('wrong_media');
      score -= 0.4;
    }
  }
  if ((tag === 'bill' || tag === 'lab' || tag === 'prescription') && mime === 'video/') {
    issues.push('video_rejected');
    score = 0;
  }

  const lap = Number(meta?.laplacian_variance ?? meta?.sharpness_score ?? NaN);
  if (Number.isFinite(lap) && lap < 40) {
    issues.push('blurry');
    score -= 0.35;
  }
  const brightness = Number(meta?.brightness_score ?? meta?.brightness ?? NaN);
  if (Number.isFinite(brightness) && brightness < 0.15) {
    issues.push('too_dark');
    score -= 0.25;
  }

  // Magic-byte sniff for empty/corrupt images (JPEG / PNG / PDF / HEIC / HEIF / WebP)
  if (mime.startsWith('image/') || !mime || mime.includes('pdf')) {
    const head = buffer.slice(0, 16);
    const isJpeg = head[0] === 0xff && head[1] === 0xd8;
    const isPng = head[0] === 0x89 && head[1] === 0x50;
    const { bufferHasPdfMagic } = require('../patient-record-media-gate');
    const isPdf = bufferHasPdfMagic(buffer);
    const isWebp =
      head.length >= 12 &&
      head.slice(0, 4).toString('ascii') === 'RIFF' &&
      head.slice(8, 12).toString('ascii') === 'WEBP';
    // ISO BMFF: size(4) + 'ftyp' + brand (heic/heif/mif1/msf1/…)
    const isHeifFamily =
      head.length >= 12 &&
      head.slice(4, 8).toString('ascii') === 'ftyp' &&
      /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis|avic)/i.test(head.slice(8, 12).toString('ascii'));
    if (
      !isJpeg &&
      !isPng &&
      !isPdf &&
      !isWebp &&
      !isHeifFamily &&
      size > 0 &&
      mime.startsWith('image/')
    ) {
      issues.push('corrupt_or_unknown');
      score -= 0.3;
    }
  }

  score = Math.max(0, Math.min(1, score));
  const band = score >= 0.85 ? 'excellent' : score >= 0.65 ? 'good' : score >= 0.45 ? 'fair' : 'poor';
  const unique = [...new Set(issues)];

  if (unique.includes('too_small') || unique.includes('video_rejected') || score < 0.35) {
    return {
      ok: false,
      action: unique.includes('video_rejected') ? 'manual' : 'retake',
      quality_score: score,
      quality_band: band,
      quality_issues: unique,
      message: unique.includes('video_rejected')
        ? 'Video is not supported. Enter details manually or upload a photo/PDF.'
        : 'Capture quality is too low. Retake with better light and focus, or enter manually.',
    };
  }

  return {
    ok: true,
    action: 'proceed',
    quality_score: score,
    quality_band: band,
    quality_issues: unique,
    message: null,
  };
}

module.exports = { assessCaptureQuality };
