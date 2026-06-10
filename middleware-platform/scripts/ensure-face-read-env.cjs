'use strict';

/**
 * Pre-start hook for npm start. Face-read inference is optional for provider portal / RCM.
 * Never fails startup — only logs configuration status.
 */

const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {
  /* dotenv optional */
}

const base = String(process.env.FACE_READ_INFERENCE_BASE_URL || '').trim();
const autoStart = process.env.FACE_READ_AUTO_START;

if (!base) {
  console.log(
    '[ensure-face-read-env] FACE_READ_INFERENCE_BASE_URL not set — face-read proxy disabled (OK for provider portal).'
  );
} else {
  console.log(`[ensure-face-read-env] FACE_READ_INFERENCE_BASE_URL=${base}`);
  if (
    process.env.K_SERVICE &&
    /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/i.test(base)
  ) {
    console.warn(
      '[ensure-face-read-env] WARN: localhost inference URL on Cloud Run will fail (502). ' +
        'Set a reachable GPU host via npm run configure:face-read-inference'
    );
  }
}

process.exit(0);
