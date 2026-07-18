/**
 * Track tab must list marks from facts — not /api/patient/spots.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const trackSrc = readFileSync(join(ROOT, 'app/(tabs)/track.tsx'), 'utf8');
const marksApiSrc = readFileSync(join(ROOT, 'lib/marks-api.ts'), 'utf8');

describe('Track marks SSOT wiring', () => {
  it('reads GET /api/patient/marks and opens mark-compare — not listSpots/spots', () => {
    expect(marksApiSrc).toMatch(/MARKS_LIST_API = '\/api\/patient\/marks'/);
    expect(trackSrc).toMatch(/fetchMarksList/);
    expect(trackSrc).toMatch(/MARK_COMPARE_HREF/);
    expect(trackSrc).not.toMatch(/track-marks-api-source/);
    expect(trackSrc).not.toMatch(/>\s*\/api\/patient\/marks\s*</);
    expect(trackSrc).not.toMatch(/listSpots/);
    expect(trackSrc).not.toMatch(/spot-store/);
    expect(trackSrc).not.toMatch(/\/api\/patient\/spots/);
    expect(trackSrc).not.toMatch(/spotHref/);
  });
});
