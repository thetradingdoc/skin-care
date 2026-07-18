'use strict';

/**
 * Phase 0 deletion regressions — paths that must stay gone.
 * Would fail if P0.01–P0.15 deletions were reverted (files/dirs reappear).
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');

function exists(rel) {
  return fs.existsSync(path.join(repoRoot, rel));
}

describe('P0 deletion regressions', () => {
  test('P0.01–P0.05 audit dump dirs stay deleted', () => {
    expect(exists('todos/pending/mobile-ux-audit-2026-07-14')).toBe(false);
    expect(exists('todos/pending/app-trytouche-live-audit-2026-07-14')).toBe(false);
    expect(exists('todos/pending/app-trytouche-domain-cutover-2026-07-14')).toBe(false);
    expect(exists('todos/pending/calendar-routines-shots-2026-07-15')).toBe(false);
    expect(exists('todos/pending/ux-audit-fixes')).toBe(false);
  });

  test('P0.06–P0.11 dead capture routes stay deleted', () => {
    expect(exists('patient-app/app/capture-scan.tsx')).toBe(false);
    expect(exists('patient-app/app/capture-upload.tsx')).toBe(false);
    expect(exists('patient-app/app/capture-review.tsx')).toBe(false);
    expect(exists('patient-app/app/capture-manual-bill.tsx')).toBe(false);
    expect(exists('patient-app/app/capture-manual-payment.tsx')).toBe(false);
    expect(exists('patient-app/app/capture-complete.tsx')).toBe(false);
  });

  test('P0.13–P0.15 dead tab routes stay deleted', () => {
    expect(exists('patient-app/app/(tabs)/today.tsx')).toBe(false);
    expect(exists('patient-app/app/(tabs)/timeline.tsx')).toBe(false);
    expect(exists('patient-app/app/(tabs)/money.tsx')).toBe(false);
  });
});
