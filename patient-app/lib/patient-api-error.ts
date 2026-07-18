/**
 * Typed patient API errors so capture UX can route burst vs monthly vs AV.
 */
export class PatientApiError extends Error {
  status: number;
  error_code: string;
  body: Record<string, unknown>;

  constructor(
    message: string,
    opts: { status: number; error_code?: string; body?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'PatientApiError';
    this.status = opts.status;
    this.error_code = String(opts.error_code || message || 'REQUEST_FAILED');
    this.body = opts.body || {};
  }
}
