'use strict';

const { analyzeNewSnapshot, DISCLAIMER } = require('../services/spot-snapshot-service');

describe('spot-snapshot-service', () => {
  test('first snapshot has no change tag', () => {
    const out = analyzeNewSnapshot([]);
    expect(out.change_tag).toBeNull();
    expect(out.disclaimer).toBe(DISCLAIMER);
  });

  test('second snapshot within week is watch', () => {
    const prior = [{ captured_at: new Date().toISOString(), analysis: {} }];
    const out = analyzeNewSnapshot(prior);
    expect(out.change_tag).toBe('watch');
  });

  test('long baseline can be same', () => {
    const old = new Date(Date.now() - 35 * 86400000).toISOString();
    const prior = [{ captured_at: old, analysis: { change_tag: 'watch' } }];
    const out = analyzeNewSnapshot(prior);
    expect(out.change_tag).toBe('same');
  });
});
