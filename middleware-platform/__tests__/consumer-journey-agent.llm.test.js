'use strict';

jest.mock('../services/llm-router', () => ({
  call: jest.fn(),
}));

jest.mock('../services/consumer-rails/checkpointer', () => ({
  loadLangGraph: jest.fn(async () => null),
  getCheckpointer: jest.fn(async () => null),
}));

const { ruleBasedActions } = require('../services/consumer-journey-agent');

describe('consumer-journey-agent llm fallback', () => {
  test('ruleBasedActions routes barrier and conflict CTAs', () => {
    const actions = ruleBasedActions({
      goals: [{ goal_type: 'reduce_conflicts', status: 'active' }],
      evaluate: { barrier_friction_index: 50, conflicts: [{}, {}] },
      spots: [],
      insight: null,
    });
    expect(actions.some((a) => a.type === 'barrier_recovery')).toBe(true);
    expect(actions.some((a) => a.type === 'resolve_conflicts')).toBe(true);
    expect(actions[0].route).toBeTruthy();
  });
});
