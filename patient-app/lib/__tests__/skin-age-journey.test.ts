import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPatientPost = vi.fn();
const mockSetJourneyProfile = vi.fn();
const mockPatchConsumerProfile = vi.fn();

vi.mock('@/lib/patient-api', () => ({
  patientPost: (...args: unknown[]) => mockPatientPost(...args),
}));

vi.mock('@/lib/journey-mode-storage', () => ({
  setJourneyProfile: (...args: unknown[]) => mockSetJourneyProfile(...args),
}));

vi.mock('@/lib/consumer-profile-api', () => ({
  patchConsumerProfile: (...args: unknown[]) => mockPatchConsumerProfile(...args),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import { completeSkinAgeJourney, hasSkinAgeJourneyData } from '@/lib/skin-age-journey';

describe('skin-age-journey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockPatientPost.mockReset();
    mockSetJourneyProfile.mockReset();
    mockPatchConsumerProfile.mockReset();
    mockPatientPost.mockResolvedValue({ success: true });
    mockSetJourneyProfile.mockResolvedValue(true);
    mockPatchConsumerProfile.mockResolvedValue({ journey_modes: ['routine'] });
  });

  it('detects sessionStorage funnel data', () => {
    expect(hasSkinAgeJourneyData()).toBe(false);
    sessionStorage.setItem('sc_onboarding_concern_id', 'anti_aging');
    expect(hasSkinAgeJourneyData()).toBe(true);
  });

  it('sets journey_modes routine on complete', async () => {
    sessionStorage.setItem('sc_onboarding_concern_id', 'anti_aging');
    sessionStorage.setItem('sc_onboarding_face_read', JSON.stringify({ apparent_age_estimate: 40 }));

    const ok = await completeSkinAgeJourney('sess-1');
    expect(ok).toBe(true);
    expect(mockSetJourneyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ modes: ['routine'], primary: 'routine' }),
    );
    expect(mockPatchConsumerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ journey_modes: ['routine'], bio_calibration_complete: true }),
    );
    expect(hasSkinAgeJourneyData()).toBe(false);
  });
});
