/**
 * Progress Kelly — POST /api/patient/progress/kelly
 * Session-auth only; never send patient_id.
 */

import { patientPost } from '@/lib/patient-api';

export const PROGRESS_KELLY_API = '/api/patient/progress/kelly';

export type ProgressKellyClientAction = 'render' | 'render_fallback' | 'suppress';

export type ProgressKellyAction = {
  label?: string;
  type?: 'compare' | 'log_photo' | 'none' | string;
};

export type ProgressKellyMessage = {
  message_type?: string;
  body?: string;
  day_reference?: number | null;
  action?: ProgressKellyAction;
};

export type ProgressKellyPayload = {
  success?: boolean;
  message?: ProgressKellyMessage | null;
  status?: string | null;
  fallback?: boolean;
  client_action?: ProgressKellyClientAction;
  prior_failure?: { reason?: string | null } | null;
  reason?: string | null;
  feature_disabled?: boolean;
};

export async function fetchProgressKellyMessage(markId: string): Promise<ProgressKellyPayload> {
  const mid = String(markId || '').trim();
  if (!mid) {
    return {
      success: false,
      client_action: 'suppress',
      status: 'nothing_new',
      message: null,
    };
  }
  const data = await patientPost(PROGRESS_KELLY_API, { mark_id: mid });
  return (data && typeof data === 'object' ? data : {}) as ProgressKellyPayload;
}
