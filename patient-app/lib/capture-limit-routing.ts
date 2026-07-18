/**
 * P8.01 — Map capture meter / AV API failures to routes (pure for tests).
 */

export type CaptureLimitKind = 'burst' | 'monthly' | 'av_blocked' | null;

export function classifyCaptureApiError(payload: {
  status?: number;
  error?: string;
  error_code?: string;
  body?: { error_code?: string; error?: string };
} | null | undefined): CaptureLimitKind {
  if (!payload) return null;
  const code = String(
    payload.error_code || payload.body?.error_code || payload.error || payload.body?.error || '',
  ).toUpperCase();
  if (code.includes('AI_BURST_LIMIT') || (payload.status === 429 && code.includes('BURST'))) {
    return 'burst';
  }
  if (code.includes('AI_CAPTURE_LIMIT') || (payload.status === 402 && code.includes('CAPTURE'))) {
    return 'monthly';
  }
  if (code.includes('AV_SCAN_BLOCKED') || (payload.status === 403 && code.includes('AV'))) {
    return 'av_blocked';
  }
  return null;
}

export const AI_BURST_HREF = '/capture/ai-burst';
export const AI_CAP_HREF = '/capture/ai-cap';
