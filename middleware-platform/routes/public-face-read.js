'use strict';

const multer = require('multer');
const { analyzeWithVision } = require('../services/face-read-vision');
const { mergeFaceReadResults, isGateReject } = require('../services/face-read-merge');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

const VISION_TIMEOUT_MS = 12000;

async function proxyToInference(base, buffer, mime, filename) {
  const u8 = Buffer.isBuffer(buffer) ? new Uint8Array(buffer) : buffer;
  const form = new FormData();
  form.append('image', new Blob([u8], { type: mime }), filename || 'photo.jpg');

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 90000);
  const r = await fetch(`${base}/v1/face-read`, {
    method: 'POST',
    body: form,
    signal: ac.signal,
  });
  clearTimeout(tid);

  const text = await r.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    parsed = { raw: text };
  }

  if (!r.ok) {
    const err = new Error(parsed?.detail || parsed?.error || 'face_read_failed');
    err.status = r.status;
    err.payload = parsed;
    throw err;
  }

  return parsed;
}

function registerFaceReadPublicRoute(app, { apiLimiter }) {
  app.post('/api/public/face-read', apiLimiter, upload.single('image'), async (req, res) => {
    const base = String(process.env.FACE_READ_INFERENCE_BASE_URL || '').trim().replace(/\/$/, '');
    if (!base) {
      return res.status(503).json({
        success: false,
        error: 'face_read_service_not_configured',
        hint: 'Set FACE_READ_INFERENCE_BASE_URL in middleware .env (e.g. http://127.0.0.1:8765)',
      });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'missing_image',
        detail: 'Send multipart/form-data with field name "image" (JPEG or PNG)',
      });
    }
    if (typeof Blob === 'undefined') {
      return res.status(500).json({
        success: false,
        error: 'face_read_proxy_requires_node_18',
        detail: 'Blob API required for multipart proxy',
      });
    }

    try {
      const mime = req.file.mimetype || 'image/jpeg';
      const buffer = Buffer.isBuffer(req.file.buffer) ? req.file.buffer : Buffer.from(req.file.buffer);

      let cvResult;
      try {
        cvResult = await proxyToInference(base, buffer, mime, req.file.originalname);
      } catch (e) {
        const status = e.status || 502;
        return res.status(status).json({
          success: false,
          face_read: e.payload,
          error: e.message || 'face_read_failed',
          request_id: req.id,
        });
      }

      if (isGateReject(cvResult)) {
        const faceRead = mergeFaceReadResults(cvResult, null);
        return res.status(200).json({
          success: true,
          face_read: faceRead,
          request_id: req.id,
        });
      }

      let visionResult = null;
      let visionError = null;
      if (process.env.FACE_READ_VISION_ENABLED === '1') {
        try {
          visionResult = await Promise.race([
            analyzeWithVision(buffer, mime, cvResult?.face_bbox),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('vision_timeout')), VISION_TIMEOUT_MS)
            ),
          ]);
          if (!visionResult) {
            visionError = visionError || 'vision_parse_failed';
          }
        } catch (e) {
          visionError = e?.message || 'vision_failed';
        }
      }

      const faceRead = mergeFaceReadResults(cvResult, visionResult, { visionError });

      if (faceRead.reject_reason === 'wrong_subject') {
        return res.status(200).json({
          success: true,
          face_read: faceRead,
          request_id: req.id,
        });
      }

      return res.status(200).json({
        success: true,
        face_read: faceRead,
        request_id: req.id,
      });
    } catch (e) {
      const msg =
        e && (e.name === 'AbortError' || e.code === 'ABORT_ERR')
          ? 'face_read_timeout'
          : e.message || 'face_read_proxy_failed';
      return res.status(502).json({ success: false, error: msg, request_id: req.id });
    }
  });
}

module.exports = { registerFaceReadPublicRoute, proxyToInference };
