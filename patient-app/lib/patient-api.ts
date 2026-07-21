import { getEffectiveApiBaseUrl } from '@/config';
import { handleExpiredPatientSession, isPatientSessionAuthError } from '@/lib/patient-auth';
import { PatientApiError } from '@/lib/patient-api-error';
import { getPatientSessionId } from '@/lib/patient-session';
import { localTodayIso } from '@/lib/routine-day-mode';

const API_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

async function withSessionHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const sid = await getPatientSessionId();
  if (!sid) throw new Error('Sign in required.');
  return { ...API_HEADERS, ...extra, 'x-session-id': sid, 'x-client-date': localTodayIso() };
}

async function parseJson(res: Response) {
  return res.json().catch(() => ({}));
}

async function ensurePatientOk<T extends { success?: boolean; error?: string; error_code?: string }>(
  res: Response,
  data: T,
): Promise<T> {
  if (!res.ok || !data?.success) {
    if (isPatientSessionAuthError(res.status, data?.error)) {
      await handleExpiredPatientSession();
    }
    const code = String(data?.error_code || data?.error || 'REQUEST_FAILED');
    throw new PatientApiError(code, {
      status: res.status,
      error_code: code,
      body: data as Record<string, unknown>,
    });
  }
  return data;
}

export async function patientGet(path: string) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, { headers });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

/**
 * Binary patient GET (physician PDF, etc.). Never treat empty/non-OK as success.
 * Do not use patientGet for application/pdf — that path JSON-parses the body.
 */
export async function patientGetBinary(path: string): Promise<{
  contentType: string;
  blob: Blob;
  byteLength: number;
}> {
  const sid = await getPatientSessionId();
  if (!sid) throw new Error('Sign in required.');
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    headers: {
      'x-session-id': sid,
      'x-client-date': localTodayIso(),
      'ngrok-skip-browser-warning': 'true',
    },
  });
  const contentType = String(res.headers.get('content-type') || '');
  if (!res.ok) {
    const data = await parseJson(res);
    if (isPatientSessionAuthError(res.status, data?.error)) {
      await handleExpiredPatientSession();
    }
    const code = String(data?.error_code || data?.error || `HTTP_${res.status}`);
    throw new PatientApiError(code, {
      status: res.status,
      error_code: code,
      body: data as Record<string, unknown>,
    });
  }
  if (contentType.includes('application/json')) {
    const data = await parseJson(res);
    if (!data?.success) {
      const code = String(data?.error_code || data?.error || 'EXPORT_FAILED');
      throw new PatientApiError(code, {
        status: res.status,
        error_code: code,
        body: data as Record<string, unknown>,
      });
    }
    throw new PatientApiError('UNEXPECTED_JSON_EXPORT', {
      status: res.status,
      error_code: 'UNEXPECTED_JSON_EXPORT',
      body: data as Record<string, unknown>,
    });
  }
  const blob = await res.blob();
  if (!blob || blob.size < 5) {
    throw new PatientApiError('EMPTY_EXPORT', {
      status: res.status,
      error_code: 'EMPTY_EXPORT',
      body: {},
    });
  }
  return { contentType, blob, byteLength: blob.size };
}

export async function patientPatch(path: string, body: unknown) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

export async function patientPost(path: string, body: unknown) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

/** Multipart upload — do not set Content-Type (boundary is set automatically). */
export async function patientUploadForm(path: string, form: FormData) {
  const sid = await getPatientSessionId();
  if (!sid) throw new Error('Sign in required.');
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'x-session-id': sid,
      'x-client-date': localTodayIso(),
      'ngrok-skip-browser-warning': 'true',
    },
    body: form,
  });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

export async function publicGet(path: string) {
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
  return data;
}

export async function patientPostPublic(path: string, body: unknown) {
  const res = await fetch(`${getEffectiveApiBaseUrl()}${path}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
  return data;
}
