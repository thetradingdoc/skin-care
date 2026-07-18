/**
 * Pure capture failure → route mapping (no Expo / config imports).
 */
import {
  AI_BURST_HREF,
  AI_CAP_HREF,
  VISION_FAIL_HREF,
} from '@/constants/routes';
import { classifyCaptureApiError } from '@/lib/capture-limit-routing';
import { PatientApiError } from '@/lib/patient-api-error';

export type CapturePipelineFailureReason =
  | 'vision_fail'
  | 'quality_fail'
  | 'ai_cap'
  | 'ai_burst'
  | 'av_blocked'
  | 'camera'
  | 'no_media'
  | 'unknown';

export type CapturePipelineFailure = {
  ok: false;
  href: string;
  error_code?: string;
  reason: CapturePipelineFailureReason;
};

const QUALITY_FAIL_CODES = new Set(['QUALITY_GATE_FAILED', 'NO_PENDING_MEDIA']);

const VISION_FAIL_CODES = new Set([
  'VISION_UNAVAILABLE',
  'PERCEIVE_FAILED',
  'OCR_EMPTY',
  'DIAGNOSIS_VOCABULARY',
  'AI_SUGGESTION_LABEL_REQUIRED',
  'NOT_DIAGNOSIS_FLAG_REQUIRED',
  'AI_TEXT_REQUIRES_DELTA',
  'AI_TEXT_NOT_ALLOWLISTED',
  'AI_SUGGESTION_MUST_BE_OBJECT',
  'AI_SUGGESTION_SCHEMA',
  'PRESCRIPTION_COMMERCE_FORBIDDEN',
  'STRUCTURED_REQUIRED',
  'HEIC_UNSUPPORTED',
  'MEDIA_TYPE_DICOM_NOT_SUPPORTED',
  'MEDIA_TYPE_VIDEO_NOT_SUPPORTED',
  'MEDIA_TYPE_ZIP_NOT_SUPPORTED',
  'INVALID_PDF_MAGIC',
]);

/** Build failure href with error_code so 2c can show accurate copy (not one generic mask). */
export function captureFailureHref(
  pathname: string,
  opts: { error_code?: string; reason?: CapturePipelineFailureReason },
): string {
  const q = new URLSearchParams();
  if (opts.error_code) q.set('error_code', opts.error_code);
  if (opts.reason) q.set('reason', opts.reason);
  const qs = q.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function routeCaptureFailure(err: unknown): CapturePipelineFailure {
  if (err instanceof PatientApiError) {
    const kind = classifyCaptureApiError({
      status: err.status,
      error: err.message,
      error_code: err.error_code,
      body: err.body as { error_code?: string; error?: string },
    });
    if (kind === 'burst') {
      return { ok: false, href: String(AI_BURST_HREF), reason: 'ai_burst', error_code: err.error_code };
    }
    if (kind === 'monthly') {
      return { ok: false, href: String(AI_CAP_HREF), reason: 'ai_cap', error_code: err.error_code };
    }
    if (kind === 'av_blocked') {
      const code = err.error_code || 'AV_SCAN_BLOCKED';
      return {
        ok: false,
        href: captureFailureHref(String(VISION_FAIL_HREF), {
          error_code: code,
          reason: 'av_blocked',
        }),
        reason: 'av_blocked',
        error_code: code,
      };
    }
    const code = String(err.error_code || '').toUpperCase();
    if (QUALITY_FAIL_CODES.has(code)) {
      return {
        ok: false,
        href: captureFailureHref(String(VISION_FAIL_HREF), {
          error_code: code,
          reason: 'quality_fail',
        }),
        reason: 'quality_fail',
        error_code: code,
      };
    }
    if (VISION_FAIL_CODES.has(code) || err.status === 422 || err.status === 503) {
      return {
        ok: false,
        href: captureFailureHref(String(VISION_FAIL_HREF), {
          error_code: code || err.error_code,
          reason: 'vision_fail',
        }),
        reason: 'vision_fail',
        error_code: err.error_code,
      };
    }
  }
  const fallbackCode =
    err instanceof PatientApiError
      ? err.error_code
      : err instanceof Error
        ? err.message
        : 'unknown';
  return {
    ok: false,
    href: captureFailureHref(String(VISION_FAIL_HREF), {
      error_code: String(fallbackCode),
      reason: 'unknown',
    }),
    reason: 'unknown',
    error_code: fallbackCode,
  };
}
