/**
 * Stable capture request_id for idempotent retries.
 * Generate once per user-initiated save; reuse on retry of the same action.
 */
export function createCaptureRequestId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `req_${rand}`;
}
