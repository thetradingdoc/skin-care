/**
 * Phase B — Progress Kelly UI wiring + mark-switch intermediate-commit guard.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { resolveProgressKellyViewMode } from '@/lib/progress-kelly-view-mode';
import type { ProgressKellyPayload } from '@/lib/progress-kelly-api';

const ROOT = join(__dirname, '../..');

const payloadA: ProgressKellyPayload = {
  client_action: 'render',
  message: { body: 'Message for mark A', action: { type: 'compare', label: 'Compare' } },
};

describe('Progress Kelly Phase B wiring', () => {
  it('API client posts mark_id only (no patient_id) to progress/kelly', () => {
    const src = readFileSync(join(ROOT, 'lib/progress-kelly-api.ts'), 'utf8');
    expect(src).toMatch(/PROGRESS_KELLY_API = '\/api\/patient\/progress\/kelly'/);
    expect(src).toMatch(/patientPost\(PROGRESS_KELLY_API,\s*\{\s*mark_id:/);
    expect(src).not.toMatch(/patientPost\([^)]*patient_id/);
    expect(src).not.toMatch(/\{\s*[^}]*patientId/);
  });

  it('Progress screen handles client_action via ProgressKellyStack + mark switcher', () => {
    const progress = readFileSync(join(ROOT, 'app/(tabs)/progress.tsx'), 'utf8');
    const stack = readFileSync(
      join(ROOT, 'components/progress/ProgressKellyStack.tsx'),
      'utf8',
    );
    expect(progress).toMatch(/fetchProgressKellyMessage/);
    expect(progress).toMatch(/ProgressKellyStack/);
    expect(progress).toMatch(/kellyPayloadMarkId/);
    expect(progress).toMatch(/payloadMarkId=\{kellyPayloadMarkId\}/);
    expect(progress).toMatch(/selectedMarkId=\{selectedMarkId\}/);
    expect(progress).toMatch(/setKellyPayload\(null\)/);
    expect(stack).toMatch(/resolveProgressKellyViewMode/);
    expect(stack).toMatch(/client_action|suppress/);
  });
});

describe('Progress Kelly mark-switch intermediate commit', () => {
  it('A→B before effect resolves: never message mode with A body (loading/empty only)', () => {
    // Intermediate paint: pill B selected, kellyLoading still false, payload still A's,
    // payloadMarkId still A — the exact flash that only-checking `loading` allowed.
    const mode = resolveProgressKellyViewMode({
      loading: false,
      payload: payloadA,
      payloadMarkId: 'mark-A',
      selectedMarkId: 'mark-B',
    });
    expect(mode).not.toBe('message');
    expect(mode === 'loading' || mode === 'empty').toBe(true);
  });

  it('matching mark + not loading still shows message', () => {
    expect(
      resolveProgressKellyViewMode({
        loading: false,
        payload: payloadA,
        payloadMarkId: 'mark-A',
        selectedMarkId: 'mark-A',
      }),
    ).toBe('message');
  });
});
