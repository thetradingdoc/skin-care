const {
  buildConcernSuggestions,
  suggestConcernsFromFaceRead,
  evaluateQuickCheck,
} = require('../services/funnel-match-keywords');

describe('funnel-match-keywords vision routing', () => {
  test('dark-skin hyperpigmentation routes to hyperpigmentation_dark_skin', () => {
    const fromFace = suggestConcernsFromFaceRead(
      {
        apparent_age_estimate: 42,
        concern_scores: { hyperpigmentation: 3, acne: 0, redness: 0, dryness: 0 },
        fit_skin_tone: 'dark',
        zone_ages_estimated: false,
      },
      38,
    );
    expect(fromFace[0]).toBe('hyperpigmentation_dark_skin');
  });

  test('fake zone ages are ignored when zone_ages_estimated is true', () => {
    const fromFace = suggestConcernsFromFaceRead(
      {
        apparent_age_estimate: 30,
        zone_ages: { t_zone: 40, cheeks: 25 },
        zone_ages_estimated: true,
      },
      28,
    );
    expect(fromFace).not.toContain('acne');
  });

  test('buildConcernSuggestions merges quick check and vision', () => {
    const match = buildConcernSuggestions({
      face_read: {
        apparent_age_estimate: 45,
        concern_scores: { hyperpigmentation: 2, acne: 1 },
        fit_skin_tone: 'medium',
        zone_ages_estimated: false,
      },
      confirmed_age: 40,
      quick_check_answers: {
        skin_feel: 'Oily',
        routine_habit: 'yes_regularly',
        routine_times: ['evening'],
      },
    });
    expect(match.suggested_concern_ids.length).toBeGreaterThan(0);
    expect(match.primary_suggestion).toBeTruthy();
  });

  test('texture and pores boost acne routing', () => {
    const fromFace = suggestConcernsFromFaceRead(
      {
        apparent_age_estimate: 28,
        concern_scores: { texture: 3, pores: 3, oiliness: 2, acne: 0 },
        zone_ages_estimated: false,
      },
      26,
    );
    expect(fromFace).toContain('acne');
  });

  test('findings with severity >= 2 boost concern routing', () => {
    const fromFace = suggestConcernsFromFaceRead(
      {
        apparent_age_estimate: 35,
        concern_scores: {},
        findings: [{ id: 'dark_circles', severity: 3, zones: ['under_eye'] }],
        zone_ages_estimated: false,
      },
      32,
    );
    expect(fromFace).toContain('anti_aging');
  });
});

describe('evaluateQuickCheck routine habit', () => {
  test('starting_fresh suggests barrier_repair', () => {
    const result = evaluateQuickCheck({
      skin_feel: 'Normal',
      routine_habit: 'starting_fresh',
      routine_times: [],
    });
    expect(result.suggested_concern_ids).toContain('barrier_repair');
  });

  test('yes_regularly with spf boosts anti_aging for normal skin', () => {
    const result = evaluateQuickCheck({
      skin_feel: 'Normal',
      routine_habit: 'yes_regularly',
      routine_times: ['morning', 'spf'],
    });
    expect(result.suggested_concern_ids).toContain('anti_aging');
  });

  test('legacy pm_routine Skipped maps to barrier_repair', () => {
    const result = evaluateQuickCheck({
      skin_feel: 'Normal',
      pm_routine: 'Skipped',
    });
    expect(result.suggested_concern_ids).toContain('barrier_repair');
  });
});
