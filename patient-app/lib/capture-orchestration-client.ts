/**
 * Canonical AI capture client — Track shutter and cold onboarding both call this.
 * Hits the same HTTP path that runs orchestrateCapture (auth) or anon→orchestrateCapture.
 *
 * Phases advance only when each real HTTP call resolves (no timers):
 *   reading  → POST /api/patient/records/capture/gate  (AV + quality)
 *   extracting → captureRecordFact ai_or_manual=ai     (meter → perceive → structure → persist)
 */
import {
  CAMERA_DENIED_HREF,
  VISION_FAIL_HREF,
  confirmHrefForTag,
} from '@/constants/routes';
import type { CaptureFlowTag } from '@/lib/capture-state-machine';
import { createCaptureRequestId } from '@/lib/capture-request-id';
import { PatientApiError } from '@/lib/patient-api-error';
import { captureRecordFact, uiTagToApiTag, type CaptureTag } from '@/lib/patient-record-capture';
import { setPendingCaptureDraft } from '@/lib/pending-capture-draft';
import { consumePendingCaptureUri, peekPendingCaptureUri } from '@/lib/pending-capture-uri';
import { getEffectiveApiBaseUrl } from '@/config';
import { getPatientSessionId } from '@/lib/patient-session';
import {
  captureFailureHref,
  routeCaptureFailure,
  type CapturePipelineFailure,
} from '@/lib/route-capture-failure';
import { appendUploadToForm, uriToUploadFile } from '@/lib/upload-uri';
import { localTodayIso } from '@/lib/routine-day-mode';

export type CapturePipelinePhase = 'reading' | 'extracting';

export type CapturePipelineSuccess = {
  ok: true;
  confirmHref: string;
  factId: string;
  draft: Record<string, unknown>;
  request_id: string;
};

export type { CapturePipelineFailure };
export { captureFailureHref, routeCaptureFailure };

export type CapturePipelineResult = CapturePipelineSuccess | CapturePipelineFailure;

/** Exported so dual-entry tests assert both paths call the same function. */
export const RUN_AI_CAPTURE_ORCHESTRATION = 'runAiCaptureOrchestration';

/**
 * Run gate then full orchestrateCapture-backed capture.
 * @param entry - 'onboarding' | 'track' — logged for tests; same pipeline either way
 */
export async function runAiCaptureOrchestration(opts: {
  uiTag: CaptureFlowTag;
  entry: 'onboarding' | 'track';
  onPhase?: (phase: CapturePipelinePhase) => void;
  request_id?: string;
  /** When true, peek URI without consuming until extract succeeds */
  keepUriOnFailure?: boolean;
}): Promise<CapturePipelineResult> {
  const uiTag = opts.uiTag;
  const apiTag = uiTagToApiTag(uiTag);
  const requestId = (opts.request_id && String(opts.request_id).trim()) || createCaptureRequestId();

  const pending = opts.keepUriOnFailure
    ? await peekPendingCaptureUri()
    : await peekPendingCaptureUri();
  if (!pending?.uri) {
    return {
      ok: false,
      href: captureFailureHref(String(CAMERA_DENIED_HREF), {
        error_code: 'NO_PENDING_MEDIA',
        reason: 'no_media',
      }),
      reason: 'no_media',
      error_code: 'NO_PENDING_MEDIA',
    };
  }

  opts.onPhase?.('reading');
  try {
    await postCaptureGate({
      uri: pending.uri,
      mimeType: pending.mimeType,
      tag: apiTag,
    });
  } catch (e) {
    return routeCaptureFailure(e);
  }

  opts.onPhase?.('extracting');
  try {
    const result = await captureRecordFact({
      tag: apiTag,
      uri: pending.uri,
      mimeType: pending.mimeType,
      ai_or_manual: 'ai',
      request_id: requestId,
    });
    const previewUri = pending.uri;
    await consumePendingCaptureUri();

    const factId = String(result.fact?.id || '').trim();
    const draft =
      (result.draft as Record<string, unknown> | undefined) ||
      (result.fact?.structured_json as Record<string, unknown> | undefined) ||
      {};
    if (!factId) {
      return {
        ok: false,
        href: captureFailureHref(String(VISION_FAIL_HREF), {
          error_code: 'NO_FACT_ID',
          reason: 'vision_fail',
        }),
        reason: 'vision_fail',
        error_code: 'NO_FACT_ID',
      };
    }

    await setPendingCaptureDraft({
      factId,
      tag: uiTag,
      apiTag,
      draft,
      request_id: result.request_id,
      via: result.via,
      capture_token: result.capture_token,
      ai_or_manual: 'ai',
      preview_uri: previewUri,
      possible_duplicate: result.possible_duplicate || null,
    });

    return {
      ok: true,
      confirmHref: String(confirmHrefForTag(uiTag)),
      factId,
      draft,
      request_id: result.request_id,
    };
  } catch (e) {
    return routeCaptureFailure(e);
  }
}

async function postCaptureGate(input: {
  uri: string;
  mimeType?: string;
  tag: CaptureTag;
}): Promise<void> {
  const form = new FormData();
  form.append('tag', input.tag);
  const fileName = `gate-${input.tag}.jpg`;
  const file = await uriToUploadFile({ uri: input.uri, fileName, mimeType: input.mimeType });
  // Options-object API — never positional (form, 'file', file).
  appendUploadToForm({ form, file, fileName });

  const sid = await getPatientSessionId();
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    'x-client-date': localTodayIso(),
  };
  if (sid) headers['x-session-id'] = sid;

  const res = await fetch(`${getEffectiveApiBaseUrl()}/api/patient/records/capture/gate`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.success === false) {
    throw new PatientApiError(String(data.error_code || data.error || 'QUALITY_GATE_FAILED'), {
      status: res.status,
      error_code: String(data.error_code || data.error || 'QUALITY_GATE_FAILED'),
      body: data,
    });
  }
}
