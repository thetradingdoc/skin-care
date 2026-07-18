/**
 * P7.26–30 — Calendar legend: icon + color together (a11y), never color-only.
 * Tags match patient_record_facts / P5.10 multi-type days.
 */

export const FACTS_CALENDAR_TAGS = [
  'skin',
  'bill',
  'rx',
  'mark',
  'lab',
  'other',
] as const;

export type FactsCalendarTag = (typeof FACTS_CALENDAR_TAGS)[number];

/** Icon names must match AppIconName — kept as string to avoid RN import in tests. */
export type CalendarLegendIcon =
  | 'droplet'
  | 'book'
  | 'flame'
  | 'eye'
  | 'scan'
  | 'chart-bar';

export type CalendarLegendItem = {
  tag: FactsCalendarTag;
  label: string;
  color: string;
  /** Outline icon — required with color (v10 a11y lock). */
  icon: CalendarLegendIcon;
};

/** Locked v10 T1 legend rows (icon+color). */
export const CALENDAR_LEGEND: readonly CalendarLegendItem[] = Object.freeze([
  { tag: 'skin', label: 'skin', color: '#1D9E75', icon: 'droplet' },
  { tag: 'bill', label: 'bill/doc', color: '#185FA5', icon: 'book' },
  { tag: 'rx', label: 'Rx', color: '#854F0B', icon: 'flame' },
  { tag: 'mark', label: 'mark', color: '#791F1F', icon: 'eye' },
  { tag: 'lab', label: 'lab', color: '#314DB6', icon: 'scan' },
  { tag: 'other', label: 'other', color: '#6B7280', icon: 'chart-bar' },
]);

export function legendForTag(tag: string): CalendarLegendItem {
  const hit = CALENDAR_LEGEND.find((l) => l.tag === tag);
  if (hit) return hit;
  return {
    tag: 'other',
    label: tag || 'other',
    color: '#6B7280',
    icon: 'chart-bar',
  };
}

/** Normalize API tag (prescription → rx) for legend dots. */
export function normalizeCalendarTag(tag: string): FactsCalendarTag {
  const t = String(tag || '').toLowerCase();
  if (t === 'prescription' || t === 'rx') return 'rx';
  if ((FACTS_CALENDAR_TAGS as readonly string[]).includes(t)) return t as FactsCalendarTag;
  return 'other';
}
