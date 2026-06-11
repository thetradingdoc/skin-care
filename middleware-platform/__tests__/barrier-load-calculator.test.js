'use strict';

const {
  detectClassOverloads,
  computeBarrierMetrics,
  collectIngredientIds,
} = require('../services/barrier-load-calculator');

describe('barrier-load-calculator', () => {
  test('collectIngredientIds flattens slot ingredient lists', () => {
    const ids = collectIngredientIds([
      { ingredient_ids: ['cosing:retinol', 'salicylic acid'] },
      { steps: [{ ingredient_ids: ['glycolic acid'] }] },
    ]);
    expect(ids).toContain('retinol');
    expect(ids).toContain('salicylic acid');
    expect(ids).toContain('glycolic acid');
  });

  test('detectClassOverloads flags multiple BHA sources', () => {
    const alerts = detectClassOverloads(
      [{ ingredient_ids: ['salicylic acid', 'salicylic acid'] }],
      ['Salicylic acid toner', 'Willow bark serum'],
    );
    expect(alerts.some((a) => a.reason_codes?.includes('class_overload:bha'))).toBe(true);
  });

  test('computeBarrierMetrics returns BFI 0-100', () => {
    const heavy = computeBarrierMetrics([
      { ingredient_ids: ['retinol', 'tretinoin', 'salicylic acid', 'glycolic acid'] },
    ]);
    expect(heavy.barrier_friction_index).toBeGreaterThanOrEqual(0);
    expect(heavy.barrier_friction_index).toBeLessThanOrEqual(100);
    expect(['safe', 'elevated', 'critical']).toContain(heavy.barrier_label);

    const light = computeBarrierMetrics([{ ingredient_ids: ['ascorbic acid'] }]);
    expect(light.barrier_friction_index).toBeGreaterThan(heavy.barrier_friction_index);
  });
});
