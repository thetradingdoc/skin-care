/**
 * Progress → Calendar handoff without route params.
 * Passing search params into a tab screen has been crashing Release
 * (Calendar flashes, then process dies). Intent is in-memory + one-shot.
 */
import type { FactsCalendarTag } from '@/lib/calendar-legend';

export type CalendarIntent = {
  tag?: FactsCalendarTag;
  date?: string;
  view?: 'list' | 'month';
};

let pending: CalendarIntent | null = null;

export function setCalendarIntent(intent: CalendarIntent): void {
  pending = { ...intent };
}

/** Consume and clear — call once when Calendar gains focus. */
export function takeCalendarIntent(): CalendarIntent | null {
  const next = pending;
  pending = null;
  return next;
}

export function peekCalendarIntent(): CalendarIntent | null {
  return pending;
}
