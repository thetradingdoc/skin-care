'use strict';

const { computeProductInsight } = require('../services/consumer-insight-service');
const { parseJsonFromLlm } = require('../services/consumer-rails/node-runner');

describe('consumer-insight-graph', () => {
  test('parseJsonFromLlm extracts insight fields from LLM JSON', () => {
    const raw = JSON.stringify({
      title: 'Barrier watch',
      message: 'Your barrier is recovering — pair with moisturizer.',
      severity: 'watch',
      barrier_note: 'BFI below 60',
      skin_note: null,
    });
    const parsed = parseJsonFromLlm(raw);
    expect(parsed.title).toBe('Barrier watch');
    expect(parsed.severity).toBe('watch');
    expect(parsed.barrier_note).toBe('BFI below 60');
  });

  test('deterministic fallback insight shape', () => {
    const insight = computeProductInsight({
      product: { product_name: 'Test Serum', ingredients_text: 'retinol' },
      bioProfile: { conditions: ['rosacea'], prescriptions: [] },
      barrierFrictionIndex: 58,
      phaseLabel: 'Week 2',
      lineupHash: 'abc',
    });
    expect(insight.title).toBeTruthy();
    expect(insight.message).toBeTruthy();
    expect(['info', 'watch', 'caution']).toContain(insight.severity);
  });
});
