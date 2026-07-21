/**
 * P7.24–P7.25 — Mark new-vs-existing picker + compare-over-time UI.
 * Must consume P5.11/P5.12 APIs — never reimplement the query client-side.
 * Zero-existing-marks path is mandatory (first-ever mark).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('P7.24 Mark new-vs-existing picker', () => {
  it('consumes P5.11 /api/patient/marks (not a client re-query)', () => {
    const api = readFileSync(join(ROOT, 'lib/marks-api.ts'), 'utf8');
    expect(api).toMatch(/MARKS_LIST_API = '\/api\/patient\/marks'/);
    expect(api).toMatch(/never reimplement/);
    expect(api).not.toMatch(/FROM patient_record_facts/);

    const picker = readFileSync(join(APP, 'capture/mark-picker.tsx'), 'utf8');
    expect(picker).toMatch(/fetchMarksList/);
    expect(picker).toMatch(/screen-mark-new-vs-existing/);
    expect(picker).not.toMatch(/patientGet\(['"`]\/api\/patient\/records/);
  });

  it('handles zero-existing-marks — first-ever mark has nothing to match', () => {
    const picker = readFileSync(join(APP, 'capture/mark-picker.tsx'), 'utf8');
    expect(picker).toMatch(/mark-picker-zero-existing/);
    expect(picker).toMatch(/marks\.length === 0/);
    expect(picker).toMatch(/No earlier marks yet/);
    expect(picker).toMatch(/mark-picker-new-first/);
    expect(picker).toMatch(/zeroExisting \? \(/);
    expect(picker).toMatch(/mark-picker-existing/);
  });

  it('with existing marks offers new vs same-as-existing', () => {
    const picker = readFileSync(join(APP, 'capture/mark-picker.tsx'), 'utf8');
    expect(picker).toMatch(/mark-picker-new/);
    expect(picker).toMatch(/mark-picker-existing/);
    expect(picker).toMatch(/compare_group_id/);
    expect(picker).toMatch(/MARK_COMPARE_HREF/);
  });
});

describe('P7.25 Compare-over-time mark UI', () => {
  it('consumes P5.12 compare-group timeline — no AI narrative', () => {
    const api = readFileSync(join(ROOT, 'lib/marks-api.ts'), 'utf8');
    expect(api).toMatch(
      /MARKS_COMPARE_API_PREFIX = '\/api\/patient\/marks\/compare-group\/'/,
    );
    expect(existsSync(join(APP, 'capture/mark-compare.tsx'))).toBe(true);
    const compare = readFileSync(join(APP, 'capture/mark-compare.tsx'), 'utf8');
    expect(compare).toMatch(/fetchCompareGroupTimeline/);
    expect(compare).toMatch(/screen-mark-compare-over-time/);
    expect(compare).toMatch(/No improvement percentage is calculated or implied/);
    expect(compare).toMatch(/ObservationZoneOverlay/);
    expect(compare).toMatch(/mark-compare-timeline/);
    expect(compare).toMatch(/mark-compare-honesty/);
    expect(compare).not.toMatch(/mark-compare-api-source/);
    expect(compare).not.toMatch(/MARKS_COMPARE_API_PREFIX/);
    expect(compare).not.toMatch(/generateNarrative|aiNarrative/);
    expect(compare).not.toMatch(/moisture_pct|health_score/);
  });
});
