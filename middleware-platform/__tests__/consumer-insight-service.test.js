'use strict';

const {
  computeProductInsight,
  isV3InsightsEnabled,
} = require('../services/consumer-insight-service');

describe('consumer-insight-service', () => {
  test('insights disabled by default', () => {
    delete process.env.FEATURE_V3_INSIGHTS;
    expect(isV3InsightsEnabled()).toBe(false);
  });

  test('computeProductInsight returns severity and message', () => {
    const insight = computeProductInsight({
      product: { product_name: 'Retinol Serum', ingredients_text: 'retinol 0.5%' },
      bioProfile: { conditions: ['barrier_compromised'] },
      barrierFrictionIndex: 55,
      phaseLabel: 'Week 2 — calm',
      lineupHash: 'abc',
    });
    expect(insight.title).toBe('Retinol Serum');
    expect(insight.message).toBeTruthy();
    expect(['info', 'watch', 'caution']).toContain(insight.severity);
  });
});
