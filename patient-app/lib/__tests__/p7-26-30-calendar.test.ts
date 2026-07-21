/**
 * P7.26–P7.30 — Calendar UI against P5.10 multi-type API + v10 legend (icon+color).
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { CALENDAR_EMPTY_BODY, CALENDAR_EMPTY_TITLE } from '@/lib/calendar-empty-copy';
import { CALENDAR_LEGEND, legendForTag } from '@/lib/calendar-legend';
import {
  dayTagDots,
  FACTS_CALENDAR_API,
  filterDaysByTag,
  tagsForDay,
  type FactsCalendarDay,
} from '@/lib/facts-calendar';

const ROOT = join(__dirname, '../..');

describe('P7.26–30 Calendar UI', () => {
  it('P7.26 multi-type day shows all tags — never collapses to one', () => {
    const day: FactsCalendarDay = {
      date: '2026-07-16',
      tags: ['skin', 'bill', 'mark'],
      multi_type: true,
      facts: [
        { id: '1', tag: 'skin' },
        { id: '2', tag: 'bill' },
        { id: '3', tag: 'mark' },
      ],
    };
    expect(day.multi_type).toBe(true);
    expect(tagsForDay(day)).toEqual(['skin', 'bill', 'mark']);
    expect(dayTagDots(day)).toHaveLength(3);
    expect(dayTagDots(day)).not.toHaveLength(1);
  });

  it('P7.26/P7.28 calendar screen + month use P5.10 facts API (not journal re-query)', () => {
    const screen = readFileSync(join(ROOT, 'app/(tabs)/calendar.tsx'), 'utf8');
    const api = readFileSync(join(ROOT, 'lib/facts-calendar-api.ts'), 'utf8');
    const helpers = readFileSync(join(ROOT, 'lib/facts-calendar.ts'), 'utf8');
    expect(helpers).toMatch(/\/api\/patient\/records\/calendar/);
    expect(FACTS_CALENDAR_API).toBe('/api/patient/records/calendar');
    expect(screen).toMatch(/fetchFactsCalendar/);
    expect(screen).toMatch(/FactsCalendarMonth/);
    expect(screen).not.toMatch(/journal\/calendar-range/);
    expect(api).toMatch(/never reimplement/);
    expect(api).toMatch(/\/api\/patient\/records\/calendar/);
  });

  it('P7.27 list view component exists and expands multi-type into rows', () => {
    const list = readFileSync(
      join(ROOT, 'components/facts-calendar/FactsCalendarList.tsx'),
      'utf8',
    );
    expect(list).toMatch(/P7\.27/);
    expect(list).toMatch(/day\.facts/);
    expect(list).toMatch(/\.map\(/);
    expect(list).toMatch(/calendar-list/);
    expect(list).toMatch(/SessionImage/);
  });

  it('P7.28 legend is icon+color together, not color-only', () => {
    expect(CALENDAR_LEGEND.length).toBeGreaterThanOrEqual(6);
    for (const item of CALENDAR_LEGEND) {
      expect(item.icon, item.tag).toBeTruthy();
      expect(item.color, item.tag).toMatch(/^#/);
      expect(item.label, item.tag).toBeTruthy();
    }
    const legendUi = readFileSync(
      join(ROOT, 'components/facts-calendar/FactsCalendarLegend.tsx'),
      'utf8',
    );
    expect(legendUi).toMatch(/AppIcon/);
    expect(legendUi).toMatch(/swatch/);
    expect(legendUi).toMatch(/icon and a color/);
    const month = readFileSync(
      join(ROOT, 'components/facts-calendar/FactsCalendarMonth.tsx'),
      'utf8',
    );
    expect(month).toMatch(/AppIcon/);
    expect(month).toMatch(/leg\.color/);
    expect(legendForTag('skin').icon).toBe('droplet');
  });

  it('P7.29 empty T2b copy is locked', () => {
    expect(CALENDAR_EMPTY_TITLE).toBe('Nothing logged yet');
    expect(CALENDAR_EMPTY_BODY).toMatch(/face or body|first capture/i);
    expect(existsSync(join(ROOT, 'components/facts-calendar/FactsCalendarEmpty.tsx'))).toBe(
      true,
    );
  });

  it('P7.30 day detail lists mixed record types', () => {
    const detail = readFileSync(
      join(ROOT, 'components/facts-calendar/FactsCalendarDayDetail.tsx'),
      'utf8',
    );
    expect(detail).toMatch(/P7\.30/);
    expect(detail).toMatch(/calendar-day-detail/);
    expect(detail).toMatch(/\+ add to this day/);
    expect(detail).toMatch(/facts\.map/);
    expect(detail).toMatch(/SessionImage/);
    expect(detail).toMatch(/media_url/);
  });

  it('P7.27 list rows render SessionImage when media_url present', () => {
    const list = readFileSync(
      join(ROOT, 'components/facts-calendar/FactsCalendarList.tsx'),
      'utf8',
    );
    expect(list).toMatch(/SessionImage/);
    expect(list).toMatch(/media_url/);
  });

  it('Progress See all routes Calendar via intent (not capture, not tab search params)', () => {
    const screen = readFileSync(join(ROOT, 'app/(tabs)/calendar.tsx'), 'utf8');
    const progress = readFileSync(join(ROOT, 'app/(tabs)/progress.tsx'), 'utf8');
    const intent = readFileSync(join(ROOT, 'lib/calendar-intent.ts'), 'utf8');
    const routes = readFileSync(join(ROOT, 'constants/routes.ts'), 'utf8');
    expect(intent).toMatch(/setCalendarIntent/);
    expect(intent).toMatch(/takeCalendarIntent/);
    expect(routes).toMatch(/export function calendarHref/);
    expect(progress).toMatch(/setCalendarIntent\(\{\s*tag:\s*'skin'/);
    expect(progress).toMatch(/calendarHref\(\)/);
    expect(progress).not.toMatch(/progress-timeline-see-all[\s\S]{0,200}CAPTURE_2A/);
    expect(screen).toMatch(/takeCalendarIntent/);
    expect(screen).toMatch(/filterDaysByTag/);
    expect(screen).toMatch(/calendar-tag-filter/);
    expect(screen).not.toMatch(/useLocalSearchParams/);
  });

  it('filterDaysByTag keeps matching facts and drops empty days', () => {
    const days: FactsCalendarDay[] = [
      {
        date: '2026-07-18',
        tags: ['skin', 'lab'],
        multi_type: true,
        facts: [
          { id: 'a', tag: 'skin' },
          { id: 'b', tag: 'lab' },
          { id: 'c', tag: 'skin' },
        ],
      },
      {
        date: '2026-07-17',
        tags: ['bill'],
        multi_type: false,
        facts: [{ id: 'd', tag: 'bill' }],
      },
    ];
    const skin = filterDaysByTag(days, 'skin');
    expect(skin).toHaveLength(1);
    expect(skin[0].facts.map((f) => f.id)).toEqual(['a', 'c']);
    expect(skin[0].multi_type).toBe(false);
  });
});
