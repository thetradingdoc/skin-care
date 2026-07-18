/**
 * Phase D — Journal tab retirement executed (was candidate earlier today).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');

describe('Journal tab retirement (executed)', () => {
  it('is hidden from the 5-tab shell and redirects to Calendar — not a live journal UI', () => {
    const layout = readFileSync(join(ROOT, 'app/(tabs)/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/name="_journal"/);
    expect(layout).toMatch(/href:\s*null/);

    const journal = readFileSync(join(ROOT, 'app/(tabs)/_journal.tsx'), 'utf8');
    expect(journal).toMatch(/Redirect/);
    expect(journal).toMatch(/CALENDAR_HREF/);
    expect(journal).not.toMatch(/journal\/calendar-range/);
    expect(journal).not.toMatch(/RETIREMENT CANDIDATE/);
  });
});
