import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPatientGet,
  mockFetchBioProfile,
  mockFetchConsumerProfile,
  mockGetJourneyProfile,
  mockListSpots,
} = vi.hoisted(() => ({
  mockPatientGet: vi.fn(),
  mockFetchBioProfile: vi.fn(),
  mockFetchConsumerProfile: vi.fn(),
  mockGetJourneyProfile: vi.fn(),
  mockListSpots: vi.fn(),
}));

vi.mock('@/lib/patient-api', () => ({
  patientGet: mockPatientGet,
}));

vi.mock('@/lib/conflict-api', () => ({
  fetchBioProfile: mockFetchBioProfile,
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
  HOME_HREF,
  JOURNEY_CHOOSE_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TRACK_HREF,
} from '@/constants/routes';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';

function mockRoutineReady() {
  mockPatientGet.mockImplementation(async (path: string) => {
    if (path.includes('/routine/template')) return { has_template: true };
    return { products: [{ id: 'p1' }] };
  });
  mockFetchBioProfile.mockResolvedValue({
    profile_complete: true,
    conditions: ['acne'],
    prescriptions: [],
  });
}

describe('resolvePostAuthRoute', () => {
  beforeEach(() => {
    mockPatientGet.mockReset();
    mockFetchBioProfile.mockReset();
    mockFetchConsumerProfile.mockReset();
    mockGetJourneyProfile.mockReset();
    mockListSpots.mockReset();

    mockFetchConsumerProfile.mockResolvedValue({
      journey_modes: ['routine'],
      bio_calibration_complete: false,
    });
    mockGetJourneyProfile.mockResolvedValue(null);
    mockListSpots.mockResolvedValue([]);
    mockPatientGet.mockResolvedValue({ products: [] });
    mockFetchBioProfile.mockResolvedValue({
      profile_complete: false,
      conditions: [],
      prescriptions: [],
    });
  });

  it('returns journey choose when no journey mode', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: [] });
    mockGetJourneyProfile.mockResolvedValue(null);
    await expect(resolvePostAuthRoute()).resolves.toBe(JOURNEY_CHOOSE_HREF);
  });

  it('uses hint modes when server returns empty array', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: [] });
    mockGetJourneyProfile.mockResolvedValue(null);
    mockPatientGet.mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: false };
      return { products: [] };
    });
    await expect(resolvePostAuthRoute({ journeyModes: ['routine'] })).resolves.toBe(
      ROUTINE_PICK_HREF,
    );
  });

  it('returns routine pick when no template', async () => {
    mockPatientGet.mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: false };
      return { products: [] };
    });
    mockFetchBioProfile.mockResolvedValue({
      profile_complete: true,
      conditions: ['acne'],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(ROUTINE_PICK_HREF);
  });

  it('returns bio calibration when profile incomplete', async () => {
    mockPatientGet.mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: true };
      return { products: [{ id: 'p1' }] };
    });
    mockFetchBioProfile.mockResolvedValue({
      profile_complete: false,
      conditions: [],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(BIO_CALIBRATION_HREF);
  });

  it('returns scan when shelf is empty', async () => {
    mockPatientGet.mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: true };
      return { products: [] };
    });
    mockFetchBioProfile.mockResolvedValue({
      profile_complete: true,
      conditions: ['acne'],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(SCAN_HREF);
  });

  it('returns home when shelf has products', async () => {
    mockRoutineReady();
    await expect(resolvePostAuthRoute()).resolves.toBe(HOME_HREF);
  });

  it('watch-only with no spots routes to track', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['watch'] });
    mockListSpots.mockResolvedValue([]);
    await expect(resolvePostAuthRoute()).resolves.toBe(TRACK_HREF);
  });

  it('watch-only with spots routes to home', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['watch'] });
    mockListSpots.mockResolvedValue([
      {
        id: 'spot-1',
        label: 'Neck spot',
        bodyRegion: 'neck',
        createdAt: '2026-06-01T00:00:00.000Z',
        photos: [],
      },
    ]);
    await expect(resolvePostAuthRoute()).resolves.toBe(HOME_HREF);
  });

  it('watch+routine with no spots routes to track after routine gates', async () => {
    mockFetchConsumerProfile.mockResolvedValue({ journey_modes: ['watch', 'routine'] });
    mockRoutineReady();
    mockListSpots.mockResolvedValue([]);
    await expect(resolvePostAuthRoute()).resolves.toBe(TRACK_HREF);
  });

  it('falls back to home on transient API errors when journey is known locally', async () => {
    mockFetchConsumerProfile.mockRejectedValue(new Error('network'));
    mockGetJourneyProfile.mockResolvedValue({
      modes: ['routine'],
      primary: 'routine',
      chosenAt: '2026-06-01T00:00:00.000Z',
    });
    mockRoutineReady();
    await expect(resolvePostAuthRoute()).resolves.toBe(HOME_HREF);
  });
});
