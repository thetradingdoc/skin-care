'use strict';

const { ruleBasedActions, isNextGenPipelineEnabled } = require('../services/consumer-journey-agent');

describe('consumer-journey-agent', () => {
  test('isNextGenPipelineEnabled reads env', () => {
    const prev = process.env.NEXT_GEN_PIPELINE;
    process.env.NEXT_GEN_PIPELINE = '1';
    expect(isNextGenPipelineEnabled()).toBe(true);
    process.env.NEXT_GEN_PIPELINE = prev;
  });

  test('ruleBasedActions suggests barrier and conflicts', () => {
    const actions = ruleBasedActions({
      goals: [{ goal_type: 'improve_routine', status: 'active' }],
      evaluate: { barrier_friction_index: 55, conflicts: [{}, {}] },
      spots: [],
      insight: null,
    });
    expect(actions.some((a) => a.type === 'barrier_recovery')).toBe(true);
    expect(actions.some((a) => a.type === 'resolve_conflicts')).toBe(true);
  });
});
