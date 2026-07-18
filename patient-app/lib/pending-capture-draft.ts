/**
 * Stash orchestration draft between loading → confirm → reveal.
 * Sibling to pending-capture-uri (media) — not route params.
 */
import { Platform } from 'react-native';

import { sessionPersistDelete, sessionPersistGet, sessionPersistSet } from '@/lib/local-persist';
import type { CaptureFlowTag } from '@/lib/capture-state-machine';

const SESSION_KEY = 'pending_capture_draft_v1';

export type PendingCaptureDraft = {
  factId: string;
  tag: CaptureFlowTag;
  apiTag: 'skin' | 'bill' | 'prescription' | 'mark' | 'lab' | 'other';
  draft: Record<string, unknown>;
  request_id: string;
  via: 'authenticated_capture' | 'anonymous_capture';
  capture_token?: string;
  ai_or_manual: 'ai' | 'manual';
  /** Local photo URI for confirm overlay (not persisted to server). */
  preview_uri?: string;
};

let memoryDraft: PendingCaptureDraft | null = null;

function readWeb(): PendingCaptureDraft | null {
  const raw = sessionPersistGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCaptureDraft;
    if (!parsed?.factId || !parsed?.draft) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeWeb(value: PendingCaptureDraft | null): void {
  if (!value) {
    sessionPersistDelete(SESSION_KEY);
    return;
  }
  sessionPersistSet(SESSION_KEY, JSON.stringify(value));
}

export async function setPendingCaptureDraft(value: PendingCaptureDraft): Promise<void> {
  memoryDraft = value;
  if (Platform.OS === 'web') writeWeb(value);
}

export async function peekPendingCaptureDraft(): Promise<PendingCaptureDraft | null> {
  if (Platform.OS === 'web') return readWeb() || memoryDraft;
  return memoryDraft;
}

export async function clearPendingCaptureDraft(): Promise<void> {
  memoryDraft = null;
  if (Platform.OS === 'web') writeWeb(null);
}

/** Merge edited fields into the stashed draft (confirm screen edits). */
export async function patchPendingCaptureDraft(
  patch: Partial<PendingCaptureDraft> & { draft?: Record<string, unknown>; replaceDraft?: boolean },
): Promise<PendingCaptureDraft | null> {
  const cur = await peekPendingCaptureDraft();
  if (!cur) return null;
  const { replaceDraft, draft: draftPatch, ...rest } = patch;
  const next: PendingCaptureDraft = {
    ...cur,
    ...rest,
    draft: draftPatch
      ? replaceDraft
        ? { ...draftPatch }
        : { ...cur.draft, ...draftPatch }
      : cur.draft,
  };
  await setPendingCaptureDraft(next);
  return next;
}
