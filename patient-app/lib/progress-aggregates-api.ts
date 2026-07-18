/**
 * P5.08 / P5.09 — Progress honest aggregates from patient_record_facts.
 * Never call /home/progress-summary or journal calendar for this purpose.
 */
import { patientGet } from '@/lib/patient-api';

export const PROGRESS_AGGREGATES_API = '/api/patient/progress/aggregates';

export type ProgressAggregatesPayload = {
  success?: boolean;
  as_of?: string;
  source?: string;
  honesty?: {
    counts_only?: boolean;
    no_inferred_trends?: boolean;
    fabricated_stats_retired?: boolean;
  };
  skin?: {
    fact_count: number;
    calmer_day_count: number;
    worse_day_count: number;
    same_day_count: number;
    baseline_day_count: number;
    self_reported_count: number;
    confirmed_ai_count: number;
  };
  bill?: {
    fact_count: number;
    total_amount_cents: number;
    total_amount: number;
    currency: string;
  };
  rx?: {
    fact_count: number;
    reminder_opt_in_count: number;
    reminders: Array<{ fact_id: string; drug: string | null; expiry: string | null }>;
  };
  mark?: {
    fact_count: number;
    compare_group_count: number;
  };
};

export async function fetchProgressAggregates(): Promise<ProgressAggregatesPayload> {
  const data = await patientGet(PROGRESS_AGGREGATES_API);
  return {
    success: data?.success !== false,
    as_of: data?.as_of,
    source: data?.source || 'patient_record_facts',
    honesty: data?.honesty,
    skin: data?.skin,
    bill: data?.bill,
    rx: data?.rx,
    mark: data?.mark,
  };
}

export {
  progressShowsSkinModule,
  progressShowsBillModule,
} from '@/lib/progress-module-visibility';

/** Consecutive days with ≥1 confirmed fact, ending at todayIso (0 if today empty). */
export function streakFromFactDays(factDates: string[], todayIso: string): number {
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
