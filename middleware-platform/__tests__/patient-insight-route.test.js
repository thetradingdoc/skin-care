'use strict';

const { isV3InsightsEnabled } = require('../services/consumer-insight-service');
const { parseInsightPayload } = require('../services/consumer-insight-schema');

describe('patient insight route flags', () => {
  afterEach(() => {
    delete process.env.FEATURE_V3_INSIGHTS;
    delete process.env.FEATURE_V3_INSIGHTS_LLM;
  });

  test('insights disabled when flag off', () => {
    process.env.FEATURE_V3_INSIGHTS = '0';
    expect(isV3InsightsEnabled()).toBe(false);
  });

  test('insights enabled when flag on', () => {
    process.env.FEATURE_V3_INSIGHTS = '1';
    expect(isV3InsightsEnabled()).toBe(true);
  });

  test('validated insight shape for API response', () => {
    const insight = parseInsightPayload({
      title: 'Test',
      message: 'Body',
      severity: 'info',
    });
    expect(insight?.title).toBe('Test');
  });
});
