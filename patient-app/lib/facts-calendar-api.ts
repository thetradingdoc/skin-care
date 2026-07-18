/**
 * P5.10 client — must call `/api/patient/records/calendar` (never reimplement the query).
 */
import { patientGet } from '@/lib/patient-api';
import {
  FACTS_CALENDAR_API,
  type FactsCalendarDay,
  type FactsCalendarPayload,
} from '@/lib/facts-calendar';

export async function fetchFactsCalendar(opts: {
  month?: string;
  start?: string;
  end?: string;
}): Promise<FactsCalendarPayload> {
  const q = new URLSearchParams();
  if (opts.month) q.set('month', opts.month);
  if (opts.start) q.set('start', opts.start);
  if (opts.end) q.set('end', opts.end);
  const data = await patientGet(`${FACTS_CALENDAR_API}?${q.toString()}`);
  const days = Array.isArray(data?.days) ? (data.days as FactsCalendarDay[]) : [];
  return {
    success: data?.success !== false,
    start: data?.start,
    end: data?.end,
    days,
    source: data?.source || 'patient_record_facts',
  };
}
