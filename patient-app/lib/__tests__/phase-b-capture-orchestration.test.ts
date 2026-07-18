/**
 * Phase B — dual entry (Track + onboarding) + loading orchestration wiring.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = join(__dirname, '../..');

const {
  captureRecordFact,
  peekPendingCaptureUri,
  consumePendingCaptureUri,
  setPendingCaptureDraft,
  getPatientSessionId,
  uriToUploadFile,
  appendUploadToForm,
} = vi.hoisted(() => ({
  captureRecordFact: vi.fn(async () => ({
    success: true,
    fact: {
      id: 'prf_test_1',
      structured_json: {
        date: '2026-07-16',
        body_area: 'cheek, left',
        ai_suggestion: {
          text: 'some redness',
          labeled: 'ai_suggestion',
          not_diagnosis: true,
        },
      },
    },
    draft: {
      date: '2026-07-16',
      body_area: 'cheek, left',
      ai_suggestion: {
        text: 'some redness',
        labeled: 'ai_suggestion',
        not_diagnosis: true,
      },
    },
    request_id: 'req_dual_1',
    via: 'authenticated_capture' as const,
  })),
  peekPendingCaptureUri: vi.fn(async () => ({
    uri: 'file://test.jpg',
    mimeType: 'image/jpeg',
  })),
  consumePendingCaptureUri: vi.fn(async () => ({
    uri: 'file://test.jpg',
    mimeType: 'image/jpeg',
  })),
  setPendingCaptureDraft: vi.fn(async () => undefined),
  getPatientSessionId: vi.fn(async () => 'sess_1'),
  uriToUploadFile: vi.fn(async () => ({
    uri: 'file://test.jpg',
    name: 'gate.jpg',
    type: 'image/jpeg',
  })),
  appendUploadToForm: vi.fn(),
}));

vi.mock('@/lib/patient-record-capture', async () => {
  const actual = await vi.importActual<typeof import('@/lib/patient-record-capture')>(
    '@/lib/patient-record-capture',
  );
  return { ...actual, captureRecordFact };
});
vi.mock('@/lib/pending-capture-uri', () => ({
  peekPendingCaptureUri,
  consumePendingCaptureUri,
  setPendingCaptureUri: vi.fn(),
}));
vi.mock('@/lib/pending-capture-draft', () => ({
  setPendingCaptureDraft,
  peekPendingCaptureDraft: vi.fn(),
  clearPendingCaptureDraft: vi.fn(),
  patchPendingCaptureDraft: vi.fn(),
}));
vi.mock('@/lib/patient-session', () => ({ getPatientSessionId }));
vi.mock('@/lib/upload-uri', () => ({ uriToUploadFile, appendUploadToForm }));
vi.mock('@/config', () => ({ getEffectiveApiBaseUrl: () => 'https://api.test' }));
vi.mock('@/lib/routine-day-mode', () => ({ localTodayIso: () => '2026-07-16' }));

import { runAiCaptureOrchestration } from '@/lib/capture-orchestration-client';

describe('Phase B dual-entry → same runAiCaptureOrchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/capture/gate')) {
          return {
            ok: true,
            json: async () => ({ success: true, quality: { ok: true }, step: 'reading' }),
          };
        }
        return { ok: true, json: async () => ({ success: true }) };
      }),
    );
  });

  it('onboarding and track entries both call captureRecordFact with ai_or_manual=ai', async () => {
    const phasesOnboarding: string[] = [];
    const a = await runAiCaptureOrchestration({
      uiTag: 'skin',
      entry: 'onboarding',
      onPhase: (p) => phasesOnboarding.push(p),
      request_id: 'req_onboarding',
    });
    expect(a.ok).toBe(true);
    expect(phasesOnboarding).toEqual(['reading', 'extracting']);

    const phasesTrack: string[] = [];
    const b = await runAiCaptureOrchestration({
      uiTag: 'skin',
      entry: 'track',
      onPhase: (p) => phasesTrack.push(p),
      request_id: 'req_track',
    });
    expect(b.ok).toBe(true);
    expect(phasesTrack).toEqual(['reading', 'extracting']);

    expect(captureRecordFact).toHaveBeenCalledTimes(2);
    for (const call of captureRecordFact.mock.calls) {
      expect(call[0].ai_or_manual).toBe('ai');
      expect(call[0].tag).toBe('skin');
      expect(call[0].uri).toBe('file://test.jpg');
    }
    expect(setPendingCaptureDraft).toHaveBeenCalled();
  });

  it('loading.tsx has no setTimeout and calls runAiCaptureOrchestration', () => {
    const src = readFileSync(join(ROOT, 'app/capture/loading.tsx'), 'utf8');
    expect(src).not.toMatch(/setTimeout/);
    expect(src).toMatch(/runAiCaptureOrchestration/);
  });

  it('welcome routes to consent before capture', () => {
    const welcome = readFileSync(join(ROOT, 'app/welcome.tsx'), 'utf8');
    expect(welcome).toMatch(/CAPTURE_CONSENT_HREF/);
    expect(welcome).not.toMatch(/router\.push\(CAPTURE_2A_HREF\)/);
    expect(readFileSync(join(ROOT, 'app/capture/consent.tsx'), 'utf8')).toMatch(
      /capture-1-consent/,
    );
  });

  it('confirm screens call confirmRecordFact via useCaptureConfirm', () => {
    const hook = readFileSync(join(ROOT, 'lib/use-capture-confirm.ts'), 'utf8');
    expect(hook).toMatch(/confirmRecordFact/);
    expect(hook).toMatch(/request_id/);
    for (const tag of ['skin', 'bill', 'rx', 'mark', 'lab', 'other']) {
      const src = readFileSync(join(ROOT, `app/capture/confirm/${tag}.tsx`), 'utf8');
      expect(src).toMatch(/useCaptureConfirm/);
      expect(src).not.toMatch(/Allerton Eye Care/);
      expect(src).not.toMatch(/cheek, left/);
    }
  });

  it('Track shutter passes entry=track into /capture', () => {
    const track = readFileSync(join(ROOT, 'app/(tabs)/track.tsx'), 'utf8');
    expect(track).toMatch(/entry:\s*'track'/);
    expect(track).toMatch(/CAPTURE_2A_HREF/);
  });
});
