import { describe, expect, test } from 'vitest';

import {
  computeHealthScoresFromConcerns,
  meterColor,
  resolveHealthScores,
} from '../computeHealthScores';

describe('computeHealthScores', () => {
  test('prefers API health_scores when present', () => {
    const scores = resolveHealthScores({
      health_scores: { hydration: 72, clarity: 44, evenness: 38, barrier: 61 },
      concern_scores: { acne: 3 },
    });
    expect(scores.hydration).toBe(72);
    expect(scores.clarity).toBe(44);
  });

  test('derives from concern_scores when API missing', () => {
    const scores = computeHealthScoresFromConcerns({
      hyperpigmentation: 3,
      texture: 2,
      dryness: 1,
      acne: 2,
    });
    expect(scores.evenness).toBeLessThan(50);
    expect(scores.hydration).toBeLessThan(100);
    expect(scores.clarity).toBeLessThan(100);
  });

  test('neutral when no concerns', () => {
    const scores = computeHealthScoresFromConcerns({});
    expect(scores.hydration).toBe(75);
    expect(scores.barrier).toBe(75);
  });

  test('meterColor thresholds', () => {
    expect(meterColor(72)).toBe('#1D9E75');
    expect(meterColor(44)).toBe('#EF9F27');
    expect(meterColor(30)).toBe('#E24B4A');
  });
});
