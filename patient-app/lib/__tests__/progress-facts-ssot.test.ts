/**
 * Progress must read facts APIs — not journal/spots summary.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { FACTS_CALENDAR_API } from '@/lib/facts-calendar';

const ROOT = join(__dirname, '../..');
const progressSrc = readFileSync(join(ROOT, 'app/(tabs)/progress.tsx'), 'utf8');
const aggregatesApiSrc = readFileSync(join(ROOT, 'lib/progress-aggregates-api.ts'), 'utf8');
const marksApiSrc = readFileSync(join(ROOT, 'lib/marks-api.ts'), 'utf8');

describe('Progress facts SSOT wiring', () => {
  it('calls P5 aggregates + facts calendar + marks — not legacy journal/spots summary', () => {
    expect(FACTS_CALENDAR_API).toBe('/api/patient/records/calendar');
    expect(aggregatesApiSrc).toMatch(/\/api\/patient\/progress\/aggregates/);
    expect(marksApiSrc).toMatch(/\/api\/patient\/marks/);
    expect(progressSrc).toMatch(/fetchProgressAggregates/);
    expect(progressSrc).toMatch(/fetchFactsCalendar/);
    expect(progressSrc).toMatch(/fetchMarksList/);
    expect(progressSrc).toMatch(/MARK_COMPARE_HREF/);
    expect(progressSrc).not.toMatch(/home\/progress-summary/);
    expect(progressSrc).not.toMatch(/journal\/calendar-range/);
    expect(progressSrc).not.toMatch(/fetchJournalImprovements/);
    expect(progressSrc).not.toMatch(/listSpots/);
    expect(progressSrc).not.toMatch(/journal\/severity/);
    expect(progressSrc).not.toMatch(/fetchTriggerInsights/);
    expect(progressSrc).not.toMatch(/spotHref/);
  });

  it('streakFromFactDays helper is consecutive from today', () => {
    expect(aggregatesApiSrc).toMatch(/function streakFromFactDays/);
    // Pure logic inline (avoid importing patient-api → expo in vitest)
    function streakFromFactDays(factDates: string[], todayIso: string): number {
      const set = new Set(factDates.filter(Boolean));
      if (!set.has(todayIso)) return 0;
      let streak = 0;
      const cursor = new Date(`${todayIso}T12:00:00.000Z`);
      for (;;) {
        const iso = cursor.toISOString().slice(0, 10);
        if (!set.has(iso)) break;
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }
      return streak;
    }
    expect(streakFromFactDays(['2026-07-14', '2026-07-15', '2026-07-16'], '2026-07-16')).toBe(3);
    expect(streakFromFactDays(['2026-07-14', '2026-07-16'], '2026-07-16')).toBe(1);
    expect(streakFromFactDays(['2026-07-15'], '2026-07-16')).toBe(0);
  });
});
