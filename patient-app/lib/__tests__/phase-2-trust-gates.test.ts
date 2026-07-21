/**
 * Phase 2 trust gates — App Store ID, photo-only PDF copy, empty≠outage.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { copyForCaptureFailure } from '@/lib/capture-failure-copy';
import { APP_STORE_ID, APP_STORE_URL } from '@/constants/storeConfig';

const ROOT = join(__dirname, '../..');

describe('G-ASC-ID App Store listing id', () => {
  it('defaults to real ASC id 6778105762 — not placeholder 6730000000', () => {
    expect(APP_STORE_ID).toBe('6778105762');
    expect(APP_STORE_URL).toContain('id6778105762');
    expect(APP_STORE_URL).not.toContain('id6730000000');
    const src = readFileSync(join(ROOT, 'constants/storeConfig.ts'), 'utf8');
    expect(src).not.toMatch(/6730000000/);
  });
});

describe('G-PDF photo-only failure copy', () => {
  it('AV / OCR bodies do not claim in-app PDF upload', () => {
    const av = copyForCaptureFailure({ reason: 'av_blocked' });
    const ocr = copyForCaptureFailure({ error_code: 'OCR_EMPTY' });
    expect(av.body).not.toMatch(/PDF/i);
    expect(ocr.body).not.toMatch(/PDF/i);
    expect(av.body).toMatch(/photo/i);
    expect(ocr.body).toMatch(/photo/i);
  });

  it('capture-failure-copy source has no PDF upload claim', () => {
    const src = readFileSync(join(ROOT, 'lib/capture-failure-copy.ts'), 'utf8');
    expect(src).not.toMatch(/photo or PDF/i);
    expect(src).not.toMatch(/PDF from a trusted/i);
  });
});

describe('G-EMPTY outage ≠ empty', () => {
  it('Shelf / Calendar / Progress / mark-compare use LoadFailedState', () => {
    for (const rel of [
      'app/(tabs)/shelf.tsx',
      'app/(tabs)/calendar.tsx',
      'app/(tabs)/progress.tsx',
      'app/capture/mark-compare.tsx',
    ]) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(src, rel).toMatch(/LoadFailedState/);
      expect(src, rel).toMatch(/loadFailed/);
    }
  });

  it('eas store profiles lock Unlock AI purchase OFF', () => {
    const eas = readFileSync(join(ROOT, 'eas.json'), 'utf8');
    expect(eas).toMatch(/"EXPO_PUBLIC_UNLOCK_AI_PURCHASE":\s*"0"/);
  });
});
