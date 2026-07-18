/**
 * P7.03 — Authenticated cold lander → Progress.
 * Explicit proof: not Check, not journey-choose, not spot→Track, not routine gates.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const { mockFetchConsumerProfile, mockGetJourneyProfile } = vi.hoisted(() => ({
  mockFetchConsumerProfile: vi.fn(),
  mockGetJourneyProfile: vi.fn(),
}));

vi.mock('@/lib/consumer-profile-api', () => ({
  fetchConsumerProfile: mockFetchConsumerProfile,
}));

vi.mock('@/lib/journey-mode-storage', () => ({
  getJourneyProfile: mockGetJourneyProfile,
}));

import {
  BIO_CALIBRATION_HREF,
  CHECK_HREF,
  JOURNEY_CHOOSE_HREF,
  PROGRESS_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TRACK_HREF,
} from '@/constants/routes';
import { resolvePostAuthRoute, resolvePostAuthRouteSync } from '@/lib/resolve-post-auth-route';

const FORBIDDEN_COLD = [
  CHECK_HREF,
  TRACK_HREF,
  JOURNEY_CHOOSE_HREF,
  ROUTINE_PICK_HREF,
  BIO_CALIBRATION_HREF,
  SCAN_HREF,
] as const;

describe('P7.03 Authenticated cold lander → Progress', () => {
  beforeEach(() => {
    mockFetchConsumerProfile.mockReset();
    mockGetJourneyProfile.mockReset();
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: [] });
    mockGetJourneyProfile.mockResolvedValue(null);
  });

  it('cold auth lands on Progress for every journey_modes combo (incl. spot-only empty)', async () => {
    const combos: string[][] = [
      [],
      ['routine'],
      ['watch'],
      ['spot'],
      ['routine', 'watch'],
      ['spot', 'watch'],
      ['spot', 'routine'],
      ['spot', 'routine', 'watch'],
    ];
    for (const modes of combos) {
      mockFetchConsumerProfile.mockResolvedValue({ journey_modes: modes });
      const route = await resolvePostAuthRoute();
      expect(route, `modes=${JSON.stringify(modes)}`).toBe(PROGRESS_HREF);
      for (const bad of FORBIDDEN_COLD) {
        expect(route, `modes=${JSON.stringify(modes)}`).not.toBe(bad);
      }
      expect(resolvePostAuthRouteSync(modes as never)).toBe(PROGRESS_HREF);
      expect(resolvePostAuthRouteSync(modes as never)).not.toBe(TRACK_HREF);
      expect(resolvePostAuthRouteSync(modes as never)).not.toBe(CHECK_HREF);
      expect(resolvePostAuthRouteSync(modes as never)).not.toBe(JOURNEY_CHOOSE_HREF);
    }
  });

  it('spot-only with zero spots no longer diverts to Track (regression closed)', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['spot'] });
    await expect(resolvePostAuthRoute()).resolves.toBe(PROGRESS_HREF);
    expect(resolvePostAuthRouteSync(['spot'])).toBe(PROGRESS_HREF);
  });

  it('resolveInitialRoute cold-auth path calls resolvePostAuthRoute without preferProgress:false', () => {
    const gate = readFileSync(join(__dirname, '../../hooks/useOnboardingGate.ts'), 'utf8');
    expect(gate).toMatch(/return resolvePostAuthRoute\(\)/);
    expect(gate).not.toMatch(/preferProgress:\s*false/);
    expect(gate).not.toMatch(/JOURNEY_CHOOSE_HREF\)/);
  });

  it('signed-out cold start lands on Welcome (not try-verdict)', () => {
    const gate = readFileSync(join(__dirname, '../../hooks/useOnboardingGate.ts'), 'utf8');
    expect(gate).toMatch(/WELCOME_HREF/);
    expect(gate).not.toMatch(/return TRY_VERDICT_HREF/);
    const index = readFileSync(join(__dirname, '../../app/index.tsx'), 'utf8');
    expect(index).toMatch(/WELCOME_HREF/);
    expect(index).not.toMatch(/TRY_VERDICT_HREF/);
  });

  it('resolver source: Progress-only cold lander; spot→Track gate deleted', () => {
    const src = readFileSync(join(__dirname, '../resolve-post-auth-route.ts'), 'utf8');
    expect(src).toMatch(/P7\.03/);
    expect(src).toMatch(/PROGRESS_HREF/);
    expect(src).not.toMatch(/TRACK_HREF/);
    expect(src).not.toMatch(/JOURNEY_CHOOSE/);
    expect(src).not.toMatch(/ROUTINE_PICK/);
    expect(src).not.toMatch(/spotMode|listSpots|spotCount/);
  });
});
