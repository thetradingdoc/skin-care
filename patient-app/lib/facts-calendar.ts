/**
 * P7.26–30 — Pure facts-calendar helpers (no RN / network).
 * Fetch lives in facts-calendar-api.ts → `/api/patient/records/calendar` (P5.10).
 */

import { normalizeCalendarTag, type FactsCalendarTag } from '@/lib/calendar-legend';

export type FactsCalendarFact = {
  id: string;
  tag: string;
  ai_or_manual?: string;
  compare_group_id?: string | null;
  /** Present when the fact has media (signed/token URL) — used by prior-photo overlay */
  media_url?: string | null;
  media_url_expires_at?: string | null;
};

export type FactsCalendarDay = {
  date: string;
  tags: string[];
  multi_type: boolean;
  facts: FactsCalendarFact[];
};

export type FactsCalendarPayload = {
  success?: boolean;
  start?: string;
  end?: string;
  days: FactsCalendarDay[];
  source?: string;
};

/** P5.10 SSOT endpoint — do not replace with journal/calendar-range. */
export const FACTS_CALENDAR_API = '/api/patient/records/calendar';

export function tagsForDay(day: FactsCalendarDay | undefined): FactsCalendarTag[] {
  if (!day?.tags?.length) return [];
  const seen = new Set<FactsCalendarTag>();
  const out: FactsCalendarTag[] = [];
  for (const raw of day.tags) {
    const n = normalizeCalendarTag(raw);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Multi-type encoding: every tag present — never collapse to one. */
export function dayTagDots(day: FactsCalendarDay | undefined): FactsCalendarTag[] {
  return tagsForDay(day);
}

function mediaUrlFromFact(f: FactsCalendarFact): string | null {
  const url = f.media_url != null ? String(f.media_url).trim() : '';
  return url || null;
}

/** Prefer skin progress photos; fall back to any fact with media on that day. */
export function pickMediaUrlFromDay(day: FactsCalendarDay | undefined): string | null {
  if (!day?.facts?.length) return null;
  const skin = day.facts.find((f) => f.tag === 'skin' && mediaUrlFromFact(f));
  if (skin) return mediaUrlFromFact(skin);
  const withMedia = day.facts.find((f) => mediaUrlFromFact(f));
  return withMedia ? mediaUrlFromFact(withMedia) : null;
}

/**
 * Most recent day strictly before targetDate that has a photo-bearing fact.
 * Used by routine prior-photo overlay (facts calendar SSOT).
 */
export function pickPriorProgressPhotoFromDays(
  days: FactsCalendarDay[],
  targetDate: string,
): { priorDate: string | null; imageUrl: string | null } {
  const target = String(targetDate || '').trim();
  const prior = [...days]
    .filter((d) => d.date < target && pickMediaUrlFromDay(d))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!prior) return { priorDate: null, imageUrl: null };
  return { priorDate: prior.date, imageUrl: pickMediaUrlFromDay(prior) };
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  return dt.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1 + delta, 1);
  return currentMonthKey(dt);
}
