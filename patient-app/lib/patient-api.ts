import { API_BASE_URL } from '@/config';
import { handleExpiredPatientSession, isPatientSessionAuthError } from '@/lib/patient-auth';
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

async function ensurePatientOk<T extends { success?: boolean; error?: string }>(
  res: Response,
  data: T,
): Promise<T> {
  if (!res.ok || !data?.success) {
    if (isPatientSessionAuthError(res.status, data?.error)) {
      await handleExpiredPatientSession();
    }
    throw new Error(data?.error || 'Request failed');
  }
  return data;
}

export async function patientGet(path: string) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, { headers });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

export async function patientPatch(path: string, body: unknown) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  return ensurePatientOk(res, data);
}

export async function patientPost(path: string, body: unknown) {
  const headers = await withSessionHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
  return data;
}

export async function patientPostPublic(path: string, body: unknown) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: API_HEADERS,
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
  return data;
}
