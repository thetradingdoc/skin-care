/**
 * Capture failure copy — kept free of expo-router so unit tests can import it.
 */
export const VISION_FAIL_TITLE = "couldn't read this clearly";
export const QUALITY_FAIL_TITLE = "couldn't get a clear read";
export const AV_BLOCKED_TITLE = "couldn't accept this file";
export const VISION_FAIL_RETRY = 'retake or re-upload';
export const VISION_FAIL_MANUAL = 'enter it manually';

export function copyForCaptureFailure(opts: {
  error_code?: string;
  reason?: string;
}): { title: string; body: string; allowManual: boolean; testID: string } {
  const code = String(opts.error_code || '').toUpperCase();
  const reason = String(opts.reason || '').toLowerCase();

  if (reason === 'av_blocked' || code.includes('AV_') || code.includes('AV_SCAN')) {
    return {
      title: AV_BLOCKED_TITLE,
      body: 'This upload was blocked by the malware scan. Try a different photo or PDF from a trusted source.',
      allowManual: false,
      testID: 'screen-2c-av-blocked',
    };
  }
  if (reason === 'quality_fail' || code === 'QUALITY_GATE_FAILED') {
    return {
      title: QUALITY_FAIL_TITLE,
      body: 'Lighting, blur, crop, or an unreadable file format can fail the quality check. Try again with a clearer photo, or type it in.',
      allowManual: true,
      testID: 'screen-2c-quality-fail',
    };
  }
  if (code === 'OCR_EMPTY') {
    return {
      title: VISION_FAIL_TITLE,
      body: 'No readable text came through from this file. Try a clearer photo or PDF, or type it in — no dead end.',
      allowManual: true,
      testID: 'screen-2c-vision-fail',
    };
  }
  return {
    title: VISION_FAIL_TITLE,
    body: 'Lighting, blur, or a cropped edge can confuse the read. Try again or type it in — no dead end.',
    allowManual: true,
    testID: 'screen-2c-vision-fail',
  };
}
