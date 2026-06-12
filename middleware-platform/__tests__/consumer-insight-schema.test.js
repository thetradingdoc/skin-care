'use strict';

const { parseInsightPayload } = require('../services/consumer-insight-schema');

describe('consumer-insight-schema', () => {
  test('accepts valid insight', () => {
    const out = parseInsightPayload({
      title: 'Barrier watch',
      message: 'Ease off actives tonight.',
      severity: 'watch',
    });
    expect(out?.title).toBe('Barrier watch');
    expect(out?.severity).toBe('watch');
  });

  test('rejects invalid severity', () => {
    const out = parseInsightPayload({
      title: 'X',
      message: 'Y',
      severity: 'critical',
    });
    expect(out).toBeNull();
  });
});
