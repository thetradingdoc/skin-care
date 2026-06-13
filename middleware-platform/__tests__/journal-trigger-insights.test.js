'use strict';

const { computeTriggerInsights } = require('../services/journal-trigger-insights');

describe('journal trigger insights', () => {
  test('not ready before 5 entries', () => {
    const result = computeTriggerInsights([
      { entry_date: '2026-06-01', condition_tags: ['breaking_out'], note: 'wore makeup' },
      { entry_date: '2026-06-02', condition_tags: ['calm'], note: '' },
    ]);
    expect(result.ready).toBe(false);
    expect(result.insights).toEqual([]);
  });

  test('surfaces makeup correlation on flare days', () => {
    const entries = [
      { entry_date: '2026-06-10', condition_tags: ['breaking_out'], note: 'wore makeup today' },
      { entry_date: '2026-06-09', condition_tags: ['breaking_out'], note: 'makeup again' },
      { entry_date: '2026-06-08', condition_tags: ['breaking_out'], note: 'foundation' },
      { entry_date: '2026-06-07', condition_tags: ['calm'], note: 'no makeup' },
      { entry_date: '2026-06-06', condition_tags: ['dry'], note: '' },
    ];
    const result = computeTriggerInsights(entries);
    expect(result.ready).toBe(true);
    expect(result.insights.some((i) => i.label === 'Makeup')).toBe(true);
  });
});
