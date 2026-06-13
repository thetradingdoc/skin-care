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

  it('passes journey_id to funnel bridge when present', async () => {
    sessionStorage.setItem('sc_onboarding_concern_id', 'anti_aging');
    sessionStorage.setItem('sc_onboarding_journey_id', 'fj_test_123');
    sessionStorage.setItem(
      'sc_onboarding_quick_check',
      JSON.stringify({ routine_habit: 'yes_regularly', skin_feel: 'Normal' }),
    );

    await completeSkinAgeJourney('sess-1');

    expect(mockPatientPost).toHaveBeenCalledWith(
      '/api/patient/funnel/bridge',
      expect.objectContaining({ journey_id: 'fj_test_123' }),
    );
  });

  it('sets journey_modes routine on complete for routine users', async () => {
    sessionStorage.setItem('sc_onboarding_concern_id', 'anti_aging');
    sessionStorage.setItem('sc_onboarding_face_read', JSON.stringify({ apparent_age_estimate: 40 }));
    sessionStorage.setItem(
      'sc_onboarding_quick_check',
      JSON.stringify({ routine_habit: 'yes_regularly', skin_feel: 'Normal' }),
    );

    const ok = await completeSkinAgeJourney('sess-1');
    expect(ok).toBe(true);
    expect(mockPatientPost).toHaveBeenCalledWith('/api/patient/routine/template', {
      concern_id: 'anti_aging',
    });
    expect(mockSetJourneyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ modes: ['routine'], primary: 'routine' }),
    );
    expect(mockPatchConsumerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ journey_modes: ['routine'], bio_calibration_complete: true }),
    );
    expect(hasSkinAgeJourneyData()).toBe(false);
  });

  it('sets watch mode and skips template for diary users', async () => {
    sessionStorage.setItem('sc_onboarding_face_read', JSON.stringify({ apparent_age_estimate: 32 }));
    sessionStorage.setItem(
      'sc_onboarding_quick_check',
      JSON.stringify({ routine_habit: 'not_really', skin_feel: 'Irritated' }),
    );

    const ok = await completeSkinAgeJourney('sess-1');
    expect(ok).toBe(true);
    expect(mockPatientPost).not.toHaveBeenCalledWith(
      '/api/patient/routine/template',
      expect.anything(),
    );
    expect(mockSetJourneyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ modes: ['watch'], primary: 'watch' }),
    );
    expect(mockPatchConsumerProfile).toHaveBeenCalledWith(
      expect.objectContaining({ journey_modes: ['watch'] }),
    );
    expect(mockPatientPost).toHaveBeenCalledWith(
      '/api/patient/funnel/bridge',
      expect.objectContaining({
        user_goal: 'track_journal',
        journey_modes: ['watch'],
        primary_mode: 'watch',
      }),
    );
  });
});
