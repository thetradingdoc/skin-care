'use strict';

const skinrag = require('../services/skinrag-routine-service');

describe('skinrag-routine-service', () => {
  afterEach(() => {
    skinrag.resetCatalogCache();
  });

  test('getRoutineForConcern returns normalized weekly_schedule_weeks', () => {
    const routine = skinrag.getRoutineForConcern('anti_aging');
    expect(routine).toBeTruthy();
    expect(routine.concern_id).toBe('anti_aging');
    expect(Array.isArray(routine.weekly_schedule_weeks)).toBe(true);
    expect(routine.sources).toHaveProperty('total_count');
  });

  test('unknown concern returns null', () => {
    expect(skinrag.getRoutineForConcern('not_a_concern')).toBeNull();
  });

  test('all six valid concerns load', () => {
    const ids = [
      'anti_aging',
      'acne',
      'hyperpigmentation',
      'hyperpigmentation_dark_skin',
      'barrier_repair',
      'rosacea',
    ];
    for (const id of ids) {
      expect(skinrag.getRoutineForConcern(id)?.concern_id).toBe(id);
    }
  });
});
