/**
 * Phase D close-out — prior-photo overlay for routine capture.
 * Reads P5.10 facts calendar only (same SSOT as Calendar/Progress).
 */

import { fetchFactsCalendar } from '@/lib/facts-calendar-api';
import {
  FACTS_CALENDAR_API,
  pickPriorProgressPhotoFromDays,
} from '@/lib/facts-calendar';
import { localTodayIso } from '@/lib/routine-day-mode';

export { FACTS_CALENDAR_API as PRIOR_PHOTO_FACTS_CALENDAR_API };
export { pickPriorProgressPhotoFromDays } from '@/lib/facts-calendar';

function isoAddDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Most recent logged day before targetDate with a facts photo (single records/calendar call). */
export async function fetchPriorProgressPhotoUrl(targetDate: string): Promise<{
  priorDate: string | null;
  imageUrl: string | null;
}> {
  const target = String(targetDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    return { priorDate: null, imageUrl: null };
  }
  const today = localTodayIso();
  const from = isoAddDays(target, -14);
  const to = target > today ? today : isoAddDays(target, -1);
  if (to < from) {
    return { priorDate: null, imageUrl: null };
  }

  try {
    const payload = await fetchFactsCalendar({ start: from, end: to });
    return pickPriorProgressPhotoFromDays(payload.days, target);
  } catch {
    return { priorDate: null, imageUrl: null };
  }
}
