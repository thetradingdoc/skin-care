import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  getFaceRead,
  getOnboardingConcernId,
  ONBOARDING_CONCERN_ID_KEY,
  ONBOARDING_FACE_READ_KEY,
  setFaceRead,
  setOnboardingConcernId,
} from '@/lib/onboarding-storage';

describe('onboarding-storage web persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips face read via localStorage on web', async () => {
    const payload = { apparent_age_estimate: 32, scan_summary: 'Test' };
    await setFaceRead(payload);
    expect(localStorage.getItem(ONBOARDING_FACE_READ_KEY)).toContain('32');
    const read = await getFaceRead();
    expect(read?.apparent_age_estimate).toBe(32);
  });

  it('round-trips concern id via localStorage on web', async () => {
    await setOnboardingConcernId('acne');
    expect(localStorage.getItem(ONBOARDING_CONCERN_ID_KEY)).toBe('acne');
    await expect(getOnboardingConcernId()).resolves.toBe('acne');
  });
});
