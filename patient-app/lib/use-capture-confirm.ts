/**
 * Shared confirm submit — hydrates from pending draft, calls confirmRecordFact.
 * Local edits update draft before submit; same request_id (confirm, not re-capture).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { CAPTURE_2A_HREF, MANUAL_ENTRY_HREF, revealHrefForTag } from '@/constants/routes';
import type { CaptureFlowTag } from '@/lib/capture-state-machine';
import { confirmRecordFact } from '@/lib/patient-record-capture';
import {
  clearPendingCaptureDraft,
  peekPendingCaptureDraft,
  patchPendingCaptureDraft,
  type PendingCaptureDraft,
} from '@/lib/pending-capture-draft';
import { clearPendingCaptureUri } from '@/lib/pending-capture-uri';

export function useCaptureConfirm(uiTag: CaptureFlowTag) {
  const router = useRouter();
  const [pending, setPending] = useState<PendingCaptureDraft | null>(null);
  const [localDraft, setLocalDraft] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void peekPendingCaptureDraft().then((d) => {
      if (!d) {
        setPending(null);
        setLocalDraft({});
        return;
      }
      setPending(d);
      setLocalDraft({ ...(d.draft || {}) });
    });
  }, [uiTag]);

  const setField = useCallback((key: string, value: unknown) => {
    setLocalDraft((prev) => {
      const next = { ...prev, [key]: value };
      void patchPendingCaptureDraft({ draft: { [key]: value } }).then((p) => {
        if (p) setPending(p);
      });
      return next;
    });
  }, []);

  const submitLooksRight = useCallback(
    async (opts?: { add_to_shelf?: boolean }) => {
      if (!pending?.factId) {
        setError('No draft to confirm — retake from capture.');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        // Flush local edits into stash, then confirm existing factId (not a new capture).
        const flushed = await patchPendingCaptureDraft({
          draft: localDraft,
          replaceDraft: true,
        });
        const draftToSend = flushed?.draft || localDraft;
        const requestId = pending.request_id;
        await confirmRecordFact(pending.factId, draftToSend, {
          request_id: requestId,
          via: pending.via,
          capture_token: pending.capture_token,
          ...(opts?.add_to_shelf === true ? { add_to_shelf: true } : {}),
        });
        router.push(revealHrefForTag(uiTag) as never);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Confirm failed');
      } finally {
        setBusy(false);
      }
    },
    [pending, localDraft, router, uiTag],
  );

  const goManual = useCallback(() => {
    router.push(MANUAL_ENTRY_HREF);
  }, [router]);

  /** G-CANCEL — leave confirm without saving; no hung spinner / dead end. */
  const cancelCapture = useCallback(async () => {
    setBusy(false);
    setError(null);
    await clearPendingCaptureDraft();
    await clearPendingCaptureUri();
    setPending(null);
    setLocalDraft({});
    router.replace(CAPTURE_2A_HREF as never);
  }, [router]);

  return {
    pending,
    draft: localDraft,
    busy,
    error,
    setField,
    submitLooksRight,
    goManual,
    cancelCapture,
    loaded: pending != null,
    /** Same capture request_id — confirm is not a new capture. */
    request_id: pending?.request_id || null,
    factId: pending?.factId || null,
    possible_duplicate: pending?.possible_duplicate || null,
  };
}

export function aiSuggestionText(draft: Record<string, unknown>): string {
  const sug = draft.ai_suggestion;
  if (sug && typeof sug === 'object' && sug !== null && 'text' in sug) {
    return String((sug as { text?: unknown }).text || '').trim();
  }
  if (typeof sug === 'string') return sug.trim();
  return '';
}
