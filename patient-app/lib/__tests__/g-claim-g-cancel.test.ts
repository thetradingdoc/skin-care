/**
 * G-CLAIM / G-CANCEL adversarial source + unit gates.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const ROOT = join(__dirname, '..');
const APP = join(ROOT, '..', 'app');

describe('G-CLAIM claim-safe UI gate', () => {
  const prev = process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI;
    else process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI = prev;
  });

  it('defaults OFF (claim-safe)', async () => {
    const { isConflictVerdictUiEnabled, isClaimSafeUiMode } = await import('../claim-safe-ui');
    expect(isConflictVerdictUiEnabled()).toBe(false);
    expect(isClaimSafeUiMode()).toBe(true);
  });

  it('env=0 forces OFF', async () => {
    process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI = '0';
    const { isConflictVerdictUiEnabled } = await import('../claim-safe-ui');
    expect(isConflictVerdictUiEnabled()).toBe(false);
  });

  it('eas store profiles bake CONFLICT_VERDICT_UI=0', () => {
    const eas = readFileSync(join(ROOT, '..', 'eas.json'), 'utf8');
    expect(eas).toMatch(/"EXPO_PUBLIC_CONFLICT_VERDICT_UI":\s*"0"/);
  });

  it('shelf/scan/verdict/try/bottle gate conflict rendering', () => {
    const shelf = readFileSync(join(APP, '(tabs)/shelf.tsx'), 'utf8');
    const scan = readFileSync(join(APP, '(tabs)/scan.tsx'), 'utf8');
    const verdict = readFileSync(join(APP, 'verdict/[productId].tsx'), 'utf8');
    const bottle = readFileSync(join(APP, 'bottle.tsx'), 'utf8');
    const tryReveal = readFileSync(join(APP, 'try-reveal.tsx'), 'utf8');
    expect(shelf).toMatch(/isConflictVerdictUiEnabled/);
    expect(shelf).toMatch(/ShelfConflictHardNoSurface/);
    expect(scan).toMatch(/isConflictVerdictUiEnabled/);
    expect(verdict).toMatch(/ClaimSafeRedirect/);
    expect(bottle).toMatch(/ClaimSafeRedirect/);
    expect(tryReveal).toMatch(/ClaimSafeRedirect/);
    expect(shelf).not.toMatch(/get a safety check/);
  });
});

describe('G-CANCEL capture cancel/dropout', () => {
  it('useCaptureConfirm exposes cancelCapture', () => {
    const src = readFileSync(join(ROOT, 'use-capture-confirm.ts'), 'utf8');
    expect(src).toMatch(/cancelCapture/);
    expect(src).toMatch(/clearPendingCaptureDraft/);
    expect(src).toMatch(/clearPendingCaptureUri/);
    expect(src).toMatch(/CAPTURE_2A_HREF/);
  });

  it('loading + all six confirms have Cancel', () => {
    const loading = readFileSync(join(APP, 'capture/loading.tsx'), 'utf8');
    expect(loading).toMatch(/capture-loading-cancel/);
    expect(loading).toMatch(/Cancel/);
    for (const name of ['skin', 'rx', 'bill', 'lab', 'mark', 'other'] as const) {
      const src = readFileSync(join(APP, `capture/confirm/${name}.tsx`), 'utf8');
      expect(src).toMatch(/cancelCapture/);
      expect(src).toMatch(new RegExp(`confirm-${name}-cancel`));
    }
  });
});
