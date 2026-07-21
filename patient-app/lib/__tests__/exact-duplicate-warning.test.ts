/**
 * Exact-duplicate confirm warning — outside field templates (banner, not a template slot).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { exactDuplicateWarningCopy } from '@/lib/exact-duplicate-warning';

const confirmDir = join(__dirname, '../../app/capture/confirm');

describe('exact duplicate confirm warning', () => {
  it('copy includes logged date and Save anyway', () => {
    expect(
      exactDuplicateWarningCopy({ fact_id: 'prf_1', logged_on: '2026-07-16' }),
    ).toBe("This looks like a document you've already logged on 2026-07-16. Save anyway?");
  });

  it('copy uses document logged_on (Allerton calendar day, not upload day)', () => {
    expect(
      exactDuplicateWarningCopy({ fact_id: 'prf_allerton', logged_on: '2026-07-07' }),
    ).toBe("This looks like a document you've already logged on 2026-07-07. Save anyway?");
  });

  it('all six confirm screens mount ExactDuplicateWarning and keep Looks right', () => {
    const files = ['skin.tsx', 'bill.tsx', 'rx.tsx', 'mark.tsx', 'lab.tsx', 'other.tsx'];
    for (const f of files) {
      const src = readFileSync(join(confirmDir, f), 'utf8');
      expect(src).toMatch(/ExactDuplicateWarning/);
      expect(src).toMatch(/Looks right/);
      expect(src).toMatch(/possible_duplicate/);
    }
  });
});
