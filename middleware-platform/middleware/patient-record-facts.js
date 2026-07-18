'use strict';

/**
 * P2.08 / P2.09 — Tag enum + media_type (photo|pdf) middleware for record routes.
 */

const {
  RECORD_TAGS,
  MEDIA_TYPES,
} = require('../services/patient-record-fact-validators');

function readField(req, key) {
  if (req.body && req.body[key] != null) return req.body[key];
  if (req.query && req.query[key] != null) return req.query[key];
  return undefined;
}

/** P2.08 — reject unknown tags */
function requireRecordTag(req, res, next) {
  const raw = readField(req, 'tag');
  const tag = String(raw || '').trim().toLowerCase();
  if (!RECORD_TAGS.includes(tag)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_TAG',
      error_code: 'INVALID_TAG',
      message: `tag must be one of: ${RECORD_TAGS.join(', ')}`,
      allowed: RECORD_TAGS,
    });
  }
  req.recordTag = tag;
  return next();
}

/**
 * P2.09 — media_type photo|pdf only; video rejected explicitly.
 * Allows omit (null) for text-only manual drafts.
 */
function requireRecordMediaType(req, res, next) {
  const raw = readField(req, 'media_type');
  const mime = String(req.file?.mimetype || req.body?.mime_type || '').toLowerCase();

  if (mime.startsWith('video/') || String(raw || '').toLowerCase() === 'video') {
    return res.status(400).json({
      success: false,
      error: 'MEDIA_TYPE_VIDEO_NOT_SUPPORTED',
      error_code: 'MEDIA_TYPE_VIDEO_NOT_SUPPORTED',
      message: 'Video is not supported in this version. Use a photo or PDF.',
      allowed: MEDIA_TYPES,
    });
  }

  let mediaType = raw != null && String(raw).trim() !== '' ? String(raw).trim().toLowerCase() : null;

  if (!mediaType && mime) {
    if (mime === 'application/pdf') mediaType = 'pdf';
    else if (mime.startsWith('image/')) mediaType = 'photo';
  }

  if (mediaType && !MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_MEDIA_TYPE',
      error_code: 'INVALID_MEDIA_TYPE',
      message: `media_type must be one of: ${MEDIA_TYPES.join(', ')} (video is not supported)`,
      allowed: MEDIA_TYPES,
    });
  }

  req.recordMediaType = mediaType;
  return next();
}

module.exports = {
  requireRecordTag,
  requireRecordMediaType,
  RECORD_TAGS,
  MEDIA_TYPES,
};
