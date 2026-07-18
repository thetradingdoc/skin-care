/**
 * C2 / H3 — Product entry to the P2–P3 facts capture pipeline.
 * Authenticated → POST /api/patient/records/capture
 * Pre-auth → uploadAnonymousRecord (stashes capture_token for OTP claim)
 *
 * Always sends request_id (caller-stable across retries of the same logical action).
 */
import { getEffectiveApiBaseUrl } from '@/config';
import { uploadAnonymousRecord } from '@/lib/anonymous-record-upload';
import { createCaptureRequestId } from '@/lib/capture-request-id';
import { patientUploadForm, patientPost } from '@/lib/patient-api';
import { PatientApiError } from '@/lib/patient-api-error';
import { getPendingCaptureToken } from '@/lib/pending-capture-token';
import { getPatientSessionId } from '@/lib/patient-session';
import { localTodayIso } from '@/lib/routine-day-mode';
import { appendUploadToForm, uriToUploadFile } from '@/lib/upload-uri';

export type CaptureTag = 'skin' | 'bill' | 'prescription' | 'mark' | 'lab' | 'other';

/** UI route tag `rx` → API tag `prescription`. */
export function uiTagToApiTag(
  tag: CaptureTag | 'rx' | string,
): CaptureTag {
  const t = String(tag || '').trim().toLowerCase();
  if (t === 'rx' || t === 'prescription') return 'prescription';
  if (t === 'skin' || t === 'bill' || t === 'mark' || t === 'lab' || t === 'other') {
    return t;
  }
  return 'other';
}

export type CaptureRecordInput = {
  tag: CaptureTag;
  /** Local file URI from camera/library */
  uri?: string | null;
  mimeType?: string;
  fileName?: string;
  ai_or_manual?: 'ai' | 'manual';
  note?: string;
  body_location?: string;
  body_area?: string;
  label?: string;
  drug?: string;
  date?: string;
  compare_group_id?: string;
  /**
   * Stable across retries of the same user action. If omitted, one is generated
   * for this call only — callers that retry must pass the same id.
   */
  request_id?: string;
};

export type CaptureRecordResult = {
  success: boolean;
  fact?: Record<string, unknown>;
  draft?: Record<string, unknown>;
  capture_token?: string;
  request_id: string;
  via: 'authenticated_capture' | 'anonymous_capture';
};

async function uploadPublicForm(path: string, form: FormData) {
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'x-client-date': localTodayIso(),
    },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !data?.success) {
    throw new PatientApiError(String(data?.error_code || data?.error || 'ANON_CAPTURE_FAILED'), {
      status: res.status,
      error_code: String(data?.error_code || data?.error || 'ANON_CAPTURE_FAILED'),
      body: data,
    });
  }
  return data;
}

/**
 * Capture a medical fact through the unified pipeline (not journal/spots-only).
 */
export async function captureRecordFact(input: CaptureRecordInput): Promise<CaptureRecordResult> {
  const tag = input.tag;
  const aiOrManual = input.ai_or_manual || 'manual';
  const date = input.date || localTodayIso();
  const requestId = (input.request_id && String(input.request_id).trim()) || createCaptureRequestId();

  const structured: Record<string, unknown> = { date };
  if (input.note != null) structured.note = input.note;
  if (input.body_location) structured.body_location = input.body_location;
  if (input.body_area) structured.body_area = input.body_area;
  if (input.label) structured.label = input.label;
  if (input.drug) structured.drug = input.drug;
  if (input.compare_group_id) structured.compare_group_id = input.compare_group_id;

  return submitCaptureStructured({
    tag,
    aiOrManual,
    structured,
    requestId,
    uri: input.uri,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
}

/** Manual / confirm path with full template draft as structured_json. */
export async function captureRecordFactTemplated(input: {
  tag: CaptureTag;
  template_id?: string;
  structured: Record<string, unknown>;
  ai_or_manual?: 'ai' | 'manual';
  request_id?: string;
  uri?: string | null;
  mimeType?: string;
  fileName?: string;
}): Promise<CaptureRecordResult> {
  const tag = uiTagToApiTag(input.tag);
  const aiOrManual = input.ai_or_manual || 'manual';
  const requestId = (input.request_id && String(input.request_id).trim()) || createCaptureRequestId();
  const structured: Record<string, unknown> = {
    date: localTodayIso(),
    ...input.structured,
    template_id: input.template_id || input.structured.template_id,
  };
  if (!structured.date) structured.date = localTodayIso();
  return submitCaptureStructured({
    tag,
    aiOrManual,
    structured,
    requestId,
    uri: input.uri,
    mimeType: input.mimeType,
    fileName: input.fileName,
  });
}

async function submitCaptureStructured(opts: {
  tag: CaptureTag;
  aiOrManual: 'ai' | 'manual';
  structured: Record<string, unknown>;
  requestId: string;
  uri?: string | null;
  mimeType?: string;
  fileName?: string;
}): Promise<CaptureRecordResult> {
  const { tag, aiOrManual, structured, requestId } = opts;
  const sid = await getPatientSessionId();

  if (sid) {
    const form = new FormData();
    form.append('tag', tag);
    form.append('ai_or_manual', aiOrManual);
    form.append('structured_json', JSON.stringify(structured));
    form.append('request_id', requestId);
    if (opts.uri) {
      const fileName = opts.fileName || `capture-${tag}.jpg`;
      const file = await uriToUploadFile({
        uri: opts.uri,
        fileName,
        mimeType: opts.mimeType,
      });
      appendUploadToForm({ form, file, fileName });
      form.append('media_type', String(opts.mimeType || '').includes('pdf') ? 'pdf' : 'photo');
    }
    const data = await patientUploadForm('/api/patient/records/capture', form);
    return {
      success: true,
      fact: data.fact as Record<string, unknown> | undefined,
      draft: data.draft as Record<string, unknown> | undefined,
      request_id: requestId,
      via: 'authenticated_capture',
    };
  }

  if (opts.uri) {
    const form = new FormData();
    form.append('tag', tag);
    form.append('ai_or_manual', aiOrManual);
    form.append('confirm', aiOrManual === 'ai' ? 'false' : 'true');
    form.append('structured_json', JSON.stringify(structured));
    form.append('request_id', requestId);
    const existingTok = await getPendingCaptureToken();
    if (existingTok) form.append('capture_token', existingTok);
    const fileName = opts.fileName || `capture-${tag}.jpg`;
    const file = await uriToUploadFile({
      uri: opts.uri,
      fileName,
      mimeType: opts.mimeType,
    });
    appendUploadToForm({ form, file, fileName });
    form.append('media_type', String(opts.mimeType || '').includes('pdf') ? 'pdf' : 'photo');
    const data = await uploadPublicForm('/api/patient/records/anonymous', form);
    const { setPendingCaptureToken } = await import('@/lib/pending-capture-token');
    if (data.capture_token) await setPendingCaptureToken(String(data.capture_token));
    return {
      success: true,
      fact: data.fact as Record<string, unknown> | undefined,
      draft:
        (data.draft as Record<string, unknown> | undefined) ||
        (data.fact as { structured_json?: Record<string, unknown> } | undefined)?.structured_json,
      capture_token: data.capture_token ? String(data.capture_token) : undefined,
      request_id: requestId,
      via: 'anonymous_capture',
    };
  }

  const data = await uploadAnonymousRecord({
    tag,
    ai_or_manual: aiOrManual,
    structured_json: structured,
    confirm: true,
    request_id: requestId,
  });
  return {
    success: true,
    fact: data.fact as Record<string, unknown> | undefined,
    capture_token: data.capture_token ? String(data.capture_token) : undefined,
    request_id: requestId,
    via: 'anonymous_capture',
  };
}

/** Confirm a draft fact after user edits. */
export async function confirmRecordFact(
  factId: string,
  structured_json: Record<string, unknown>,
  extra?: {
    capture_session_id?: string;
    request_id?: string;
    /** Pre-auth confirm via capture_token */
    capture_token?: string;
    via?: 'authenticated_capture' | 'anonymous_capture';
  },
) {
  const requestId =
    (extra?.request_id && String(extra.request_id).trim()) || createCaptureRequestId();
  const sid = await getPatientSessionId();
  const token =
    (extra?.capture_token && String(extra.capture_token).trim()) ||
    (await getPendingCaptureToken()) ||
    '';

  // Route by capture provenance (`via`), not by whether SecureStore currently
  // returns a session id. Authenticated captures never stash capture_token —
  // treating a transient !sid as anonymous incorrectly throws CAPTURE_TOKEN_REQUIRED.
  const via = extra?.via;
  const useAnonymous =
    via === 'anonymous_capture' || (!via && !sid);

  if (useAnonymous) {
    if (!token) {
      throw new PatientApiError('CAPTURE_TOKEN_REQUIRED', {
        status: 401,
        error_code: 'CAPTURE_TOKEN_REQUIRED',
      });
    }
    const res = await fetch(
      `${getEffectiveApiBaseUrl()}/api/patient/records/anonymous/${encodeURIComponent(factId)}/confirm`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'x-client-date': localTodayIso(),
        },
        body: JSON.stringify({
          capture_token: token,
          structured_json,
          request_id: requestId,
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || !data?.success) {
      throw new PatientApiError(String(data?.error_code || data?.error || 'CONFIRM_FAILED'), {
        status: res.status,
        error_code: String(data?.error_code || data?.error || 'CONFIRM_FAILED'),
        body: data,
      });
    }
    return data;
  }

  if (!sid) {
    throw new PatientApiError('SESSION_REQUIRED', {
      status: 401,
      error_code: 'SESSION_REQUIRED',
      message: 'Sign in again to save this capture.',
    });
  }

  return patientPost(`/api/patient/records/${encodeURIComponent(factId)}/confirm`, {
    structured_json,
    capture_session_id: extra?.capture_session_id,
    request_id: requestId,
  });
}
