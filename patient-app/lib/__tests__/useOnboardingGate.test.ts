/**
 * P5.05 — journey_modes must never block Progress lander.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockFetchConsumerProfile,
  mockGetJourneyProfile,
  mockListSpots,
} = vi.hoisted(() => ({
  mockFetchConsumerProfile: vi.fn(),
  mockGetJourneyProfile: vi.fn(),
  mockListSpots: vi.fn(),
}));

vi.mock('@/lib/patient-api', () => ({
  patientGet: vi.fn(),
}));

vi.mock('@/lib/conflict-api', () => ({
  fetchBioProfile: vi.fn(),
}));

vi.mock('@/lib/consumer-profile-api', () => ({
  fetchConsumerProfile: mockFetchConsumerProfile,
}));

vi.mock('@/lib/journey-mode-storage', () => ({
  getJourneyProfile: mockGetJourneyProfile,
}));

vi.mock('@/lib/spot-store', () => ({
  listSpots: mockListSpots,
}));

import {
  BIO_CALIBRATION_HREF,
  PROGRESS_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TRACK_HREF,
} from '@/constants/routes';
import { resolvePostAuthRoute, resolvePostAuthRouteSync } from '@/lib/resolve-post-auth-route';

describe('resolvePostAuthRoute (P5.05)', () => {
  beforeEach(() => {
    mockFetchConsumerProfile.mockReset();
    mockGetJourneyProfile.mockReset();
    mockListSpots.mockReset();
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['routine'] });
    mockGetJourneyProfile.mockResolvedValue(null);
    mockListSpots.mockResolvedValue([]);
  });

  it('lands on Progress when no journey mode', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: [] });
    await expect(resolvePostAuthRoute()).resolves.toBe(PROGRESS_HREF);
  });

  it('P5.05 routine with empty template/shelf still Progress — not pick/bio/scan', async () => {
    await expect(resolvePostAuthRoute({ journeyModes: ['routine'] })).resolves.toBe(PROGRESS_HREF);
    expect(resolvePostAuthRouteSync(['routine'], { spotCount: 0 })).toBe(PROGRESS_HREF);
    expect(resolvePostAuthRouteSync(['routine'], { spotCount: 0 })).not.toBe(ROUTINE_PICK_HREF);
    expect(resolvePostAuthRouteSync(['routine'], { spotCount: 0 })).not.toBe(BIO_CALIBRATION_HREF);
    expect(resolvePostAuthRouteSync(['routine'], { spotCount: 0 })).not.toBe(SCAN_HREF);
  });

  it('spot-only also lands on Progress (P7.03 — Track divert retired)', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['spot'] });
    await expect(resolvePostAuthRoute()).resolves.toBe(PROGRESS_HREF);
    expect(resolvePostAuthRouteSync(['spot'])).toBe(PROGRESS_HREF);
    expect(resolvePostAuthRouteSync(['spot'])).not.toBe(TRACK_HREF);
  });

  it('watch-only lands on Progress', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['watch'] });
    await expect(resolvePostAuthRoute()).resolves.toBe(PROGRESS_HREF);
  });

  it('falls back to Progress on API errors', async () => {
    mockFetchConsumerProfile.mockRejectedValue(new Error('network'));
    mockGetJourneyProfile.mockRejectedValue(new Error('network'));
    await expect(resolvePostAuthRoute()).resolves.toBe(PROGRESS_HREF);
  });
});
