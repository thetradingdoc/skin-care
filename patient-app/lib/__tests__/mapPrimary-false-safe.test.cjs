/**
 * Trust: evaluate errors / unknown overall must never map to Safe.
 * Run: node patient-app/lib/__tests__/mapPrimary-false-safe.test.cjs
 *
 * Inlines the mapping rules (mirrors try-reveal.tsx mapPrimary) for Node without Metro.
 */
'use strict';

const assert = require('assert');

function mapPrimary(verdict) {
  if (!verdict || typeof verdict !== 'object') return 'error';
  if (verdict.success === false) return 'error';
  if (verdict.error != null && String(verdict.error).length > 0 && verdict.overall == null) {
    return 'error';
  }
  const overall = String(verdict.overall ?? '')
    .toLowerCase()
    .trim();
  if (!overall || overall === 'unknown') return 'error';
  if (overall === 'hard_no' || verdict.hard_no === true) return 'hard_no';
  if (overall === 'avoid') return 'hard_no';
  if (overall === 'caution') return 'caution';
  if (overall === 'safe') return 'safe';
  return 'error';
}

// Audit probe shape: HTTP 400 body + invented overall=unknown → must be error
assert.strictEqual(mapPrimary({ success: false, error: 'products_required', max: 2 }), 'error');
assert.strictEqual(mapPrimary({ overall: 'unknown' }), 'error');
assert.strictEqual(mapPrimary({}), 'error');
assert.strictEqual(mapPrimary(null), 'error');
assert.strictEqual(mapPrimary({ message: 'looks fine' }), 'error');

assert.strictEqual(mapPrimary({ success: true, overall: 'safe' }), 'safe');
assert.strictEqual(mapPrimary({ success: true, overall: 'caution' }), 'caution');
assert.strictEqual(mapPrimary({ success: true, overall: 'hard_no', hard_no: true }), 'hard_no');
assert.strictEqual(mapPrimary({ overall: 'avoid' }), 'hard_no');

console.log('mapPrimary false-safe: PASS');
