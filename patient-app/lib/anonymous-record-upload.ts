/**
 * P2.21 / P2.23 — Anonymous medical fact upload that stashes capture_token for OTP claim.
 * Use this (not raw patientPostPublic) so binding always receives the token.
 */
import { patientPostPublic } from '@/lib/patient-api';
import { setPendingCaptureToken } from '@/lib/pending-capture-token';

export type AnonymousRecordUploadInput = {
  tag: string;
  ai_or_manual?: 'ai' | 'manual';
  media_type?: 'photo' | 'pdf' | null;
  structured_json?: Record<string, unknown>;
  request_id?: string;
  capture_token?: string | null;
  confirm?: boolean;
  raw_extract_text?: string;
};

export type AnonymousRecordUploadResult = {
  success: boolean;
  fact?: Record<string, unknown>;
  capture_token?: string;
  anon_session_id?: string;
  expires_at?: string;
  idempotent_replay?: boolean;
  [key: string]: unknown;
};

/**
 * POST /api/patient/records/anonymous and persist capture_token for OTP verify/confirm.
 */
export async function uploadAnonymousRecord(
  body: AnonymousRecordUploadInput,
): Promise<AnonymousRecordUploadResult> {
  const json = (await patientPostPublic('/api/patient/records/anonymous', {
    ai_or_manual: body.ai_or_manual || 'manual',
    ...body,
  })) as AnonymousRecordUploadResult;

  const token = json?.capture_token ? String(json.capture_token) : '';
  if (token) {
    await setPendingCaptureToken(token);
  }
  return json;
}
