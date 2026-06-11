import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BIO_CALIBRATION_HREF,
  ROUTINE_PICK_HREF,
  SCAN_HREF,
  TODAY_HREF,
} from '@/constants/routes';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';

vi.mock('@/lib/patient-api', () => ({
  patientGet: vi.fn(),
}));

vi.mock('@/lib/conflict-api', () => ({
  fetchBioProfile: vi.fn(),
}));

import { patientGet } from '@/lib/patient-api';
import { fetchBioProfile } from '@/lib/conflict-api';

describe('resolvePostAuthRoute', () => {
  beforeEach(() => {
    vi.mocked(patientGet).mockReset();
    vi.mocked(fetchBioProfile).mockReset();
  });

  it('returns routine pick when no template', async () => {
    vi.mocked(patientGet).mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: false };
      return { products: [] };
    });
    vi.mocked(fetchBioProfile).mockResolvedValue({
      profile_complete: true,
      conditions: ['acne'],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(ROUTINE_PICK_HREF);
  });

  it('returns bio calibration when profile incomplete', async () => {
    vi.mocked(patientGet).mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: true };
      return { products: [{ id: 'p1' }] };
    });
    vi.mocked(fetchBioProfile).mockResolvedValue({
      profile_complete: false,
      conditions: [],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(BIO_CALIBRATION_HREF);
  });

  it('returns scan when shelf is empty', async () => {
    vi.mocked(patientGet).mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: true };
      return { products: [] };
    });
    vi.mocked(fetchBioProfile).mockResolvedValue({
      profile_complete: true,
      conditions: ['acne'],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(SCAN_HREF);
  });

  it('returns today when shelf has products even if evaluate would be caution', async () => {
    vi.mocked(patientGet).mockImplementation(async (path: string) => {
      if (path.includes('/routine/template')) return { has_template: true };
      return { products: [{ id: 'p1' }] };
    });
    vi.mocked(fetchBioProfile).mockResolvedValue({
      profile_complete: true,
      conditions: ['acne'],
      prescriptions: [],
    });

    await expect(resolvePostAuthRoute()).resolves.toBe(TODAY_HREF);
  });
});
