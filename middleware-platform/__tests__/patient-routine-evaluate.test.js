'use strict';

const { computeLineupHash } = require('../lib/lineup-hash');

describe('patient-routine-evaluate helpers', () => {
  test('computeLineupHash is stable for same slots', () => {
    const slots = [{ slot: 'am', product_ids: ['p1', 'p2'] }];
    const a = computeLineupHash({ slots });
    const b = computeLineupHash({ slots });
    expect(a).toBe(b);
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(8);
  });

  test('computeLineupHash changes when lineup changes', () => {
    const a = computeLineupHash({ slots: [{ slot: 'am', product_ids: ['p1'] }] });
    const b = computeLineupHash({ slots: [{ slot: 'am', product_ids: ['p2'] }] });
    expect(a).not.toBe(b);
  });
});
