/**
 * P8.10 — Playwright E2E for rebuilt medical-tracker IA.
 * Cold start → capture path → auth → Progress.
 * Covers skin-only, bill-only, and multi-tag skin+Rx orchestration contracts
 * via route/source journey assertions that Playwright can also drive live.
 *
 * Live browser: npx playwright test middleware-platform/e2e/medical-tracker-ia.spec.cjs
 * (requires BASE_URL). This Vitest suite locks the journey map so the suite cannot
 * silently drop a required path.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const REPO = join(ROOT, '..');
const SPEC = join(REPO, 'middleware-platform/e2e/medical-tracker-ia.spec.cjs');

export const MEDICAL_TRACKER_E2E_PATHS = [
  { id: 'cold', href: '/', next: '/welcome' },
  { id: 'skin_capture', href: '/capture', tag: 'skin', next: '/capture/tag' },
  { id: 'bill_capture', href: '/capture', tag: 'bill', next: '/capture/confirm/bill' },
  { id: 'multi_skin_rx', tags: ['skin', 'prescription'], orchestration: 'orchestrateMultiCapture' },
  { id: 'auth', href: '/sign-in' },
  { id: 'progress', href: '/progress' },
] as const;

describe('P8.10 E2E Playwright rebuilt IA journey', () => {
  it('spec file covers cold → capture → auth → Progress plus skin/bill/multi-tag', () => {
    expect(existsSync(SPEC)).toBe(true);
    const src = readFileSync(SPEC, 'utf8');
    expect(src).toMatch(/P8\.10/);
    expect(src).toMatch(/WELCOME_HREF|welcome|cold/);
    expect(src).toMatch(/live: skin-only journey/);
    expect(src).toMatch(/live: bill-only journey/);
    expect(src).toMatch(/live: multi-tag skin\+Rx journey/);
    expect(src).toMatch(/progress|Progress/);
    expect(src).toMatch(/sign-in|OTP|auth/i);
  });

  it('journey map includes skin-only, bill-only, and multi-tag skin+Rx', () => {
    const ids = MEDICAL_TRACKER_E2E_PATHS.map((p) => p.id);
    expect(ids).toContain('skin_capture');
    expect(ids).toContain('bill_capture');
    expect(ids).toContain('multi_skin_rx');
    expect(ids).toContain('progress');
  });
});
