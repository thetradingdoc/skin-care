/**
 * Honesty gates: check-in fail-closed + shelf-add no fake catalog search.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import {
  CHECK_IN_API,
  feelingSlugFromLabel,
  performCheckInSave,
  submitDailyCheckIn,
} from '@/lib/daily-check-in';

const ROOT = join(__dirname, '../..');

describe('daily check-in fail-closed', () => {
  it('maps chip labels to API feeling slugs', () => {
    expect(feelingSlugFromLabel('Calmer')).toBe('calmer');
    expect(feelingSlugFromLabel('About the same')).toBe('about_the_same');
    expect(feelingSlugFromLabel('Worse')).toBe('worse');
  });

  it('submitDailyCheckIn posts to check-in route', async () => {
    const post = vi.fn().mockResolvedValue({ success: true });
    await submitDailyCheckIn('calmer', post);
    expect(post).toHaveBeenCalledWith(CHECK_IN_API, {
      feeling: 'calmer',
      source: 'daily_checkin',
    });
  });

  it('performCheckInSave returns ok on success', async () => {
    const result = await performCheckInSave({
      feeling: 'worse',
      submit: async () => ({ success: true }),
    });
    expect(result).toEqual({ ok: true });
  });

  it('performCheckInSave surfaces server errors and does not imply success', async () => {
    const result = await performCheckInSave({
      feeling: 'calmer',
      submit: async () => {
        throw new Error('CHECKIN_FAILED');
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('CHECKIN_FAILED');
    }
  });

  it('screen never swallows 404 / navigates on failure', () => {
    const src = readFileSync(join(ROOT, 'app/capture/check-in.tsx'), 'utf8');
    expect(src).toMatch(/performCheckInSave/);
    expect(src).toMatch(/checkin-error/);
    expect(src).toMatch(/if \(!result\.ok\)/);
    expect(src).not.toMatch(/Backend may 404/);
    expect(src).not.toMatch(/\.catch\(\(\)\s*=>/);
    expect(src).not.toMatch(/acknowledge UX save locally/);
  });
});

describe('shelf-add honest search state', () => {
  it('UI renders fallback copy and never routes Search → nomatch', () => {
    const src = readFileSync(join(ROOT, 'app/shelf/add.tsx'), 'utf8');
    expect(src).toMatch(/Search coming soon — scan a barcode or add manually/);
    expect(src).toMatch(/shelf-add-search-coming-soon/);
    expect(src).toMatch(/SHELF_ADD_SEARCH_COMING_SOON/);
    expect(src).toMatch(/addProductManual/);
    expect(src).toMatch(/shelf-add-manual-cta/);
    expect(src).toMatch(/SCAN_HREF/);
    expect(src).not.toMatch(/SHELF_NOMATCH_HREF/);
    expect(src).not.toMatch(/testID="shelf-add-search"/);
    expect(src).not.toMatch(/Catalog miss/);
  });
});
