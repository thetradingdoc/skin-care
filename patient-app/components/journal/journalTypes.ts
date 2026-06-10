import { BillingLifecycleStatus } from '@/constants/billingV1';
import { TimelineTokens } from '@/constants/timelineTokens';

export const SUBVIEWS = ['Photos', 'Calendar', 'List', 'Documents'] as const;
export type Subview = (typeof SUBVIEWS)[number];

export type CalendarDay = {
  date: string;
  is_routine_day: boolean;
  has_entry: boolean;
  completion_score: number;
  has_media: boolean;
  photo_prompt?: boolean;
  thumbnail_url: string | null;
  program_week?: number | null;
  phase_label?: string | null;
  phase_key?: string | null;
  phase_expect_snippet?: string | null;
  day_mode?: 'today' | 'backfill' | 'historical';
  is_purge_window?: boolean;
  phase_band?: string | null;
  milestone_label?: string | null;
  has_symptoms?: boolean;
  top_symptom?: string | null;
  billing_has_due?: boolean;
  billing_has_paid?: boolean;
  billing_all_paid?: boolean;
  billing_event_count?: number;
  billing_due_cents?: number;
  billing_paid_cents?: number;
  billing_visual?: 'due' | 'paid' | 'review' | null;
};

export type PhaseChip = {
  key: string;
  label: string;
  week_start: number;
  week_end: number;
};

export function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function programWeekDayLabel(
  templateStartIso: string | null,
  dateIso: string,
  programWeek: number | null | undefined
): string | null {
  const week = Number(programWeek);
  if (!Number.isFinite(week) || week < 1) return null;
  if (!templateStartIso) return `W${week}`;
  const start = new Date(`${templateStartIso}T12:00:00`);
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(d.getTime())) return `W${week}`;
  const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  if (diff < 0) return `W${week}`;
  const dayInWeek = (diff % 7) + 1;
  return `W${week}·${dayInWeek}`;
}

export type BillingEvent = {
  id: string;
  title: string;
  provider_name: string | null;
  service_date: string | null;
  amount_cents: number | null;
  status: BillingLifecycleStatus | string;
  confidence_score: number | null;
  metadata?: Record<string, unknown> | null;
};

export type BillingDoc = {
  id: string;
  file_name: string | null;
  created_at: string;
  parse_status?: string | null;
  confidence_score?: number | null;
};

export function groupEventsByServiceDate(events: BillingEvent[]): Map<string, BillingEvent[]> {
  const m = new Map<string, BillingEvent[]>();
  for (const e of events) {
    const d = e.service_date;
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(e);
  }
  return m;
}

export function monthKeysFromSources(rows: CalendarDay[], events: BillingEvent[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => {
    const k = String(r.date || '').slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(k)) set.add(k);
  });
  events.forEach((e) => {
    const sd = e.service_date;
    if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) set.add(sd.slice(0, 7));
  });
  if (set.size === 0) {
    const d = new Date();
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return Array.from(set).sort();
}

export function billingVisualForDay(dayEvents: BillingEvent[]): 'due' | 'paid' | 'review' | null {
  if (!dayEvents.length) return null;
  if (dayEvents.some((x) => x.status === 'due')) return 'due';
  if (dayEvents.every((x) => x.status === 'paid')) return 'paid';
  return 'review';
}

export function billingVisualForCell(row: CalendarDay | undefined, dayEvents: BillingEvent[]): 'due' | 'paid' | 'review' | null {
  const v = row?.billing_visual;
  if (v === 'due' || v === 'paid' || v === 'review') return v;
  return billingVisualForDay(dayEvents);
}

export function billingStatusA11y(vis: 'due' | 'paid' | 'review' | null): string {
  if (vis === 'due') return 'Bill due';
  if (vis === 'paid') return 'Paid';
  if (vis === 'review') return 'Needs review or mixed status';
  return '';
}

export function computeStats(events: BillingEvent[]) {
  const billsDue = events.filter((e) => e.status === 'due').length;
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let owedMonth = 0;
  let paidMonth = 0;
  for (const e of events) {
    const sd = e.service_date || '';
    if (!sd.startsWith(ym)) continue;
    const cents = Number(e.amount_cents || 0);
    if (['due', 'needs_review', 'tracked', 'pending', 'disputed'].includes(String(e.status))) owedMonth += cents;
    if (e.status === 'paid') paidMonth += cents;
  }
  return { billsDue, owedMonth, paidMonth };
}

export function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatUsd(cents: number): string {
  const n = Math.max(0, cents) / 100;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dotColorForDay(isToday: boolean, billVis: ReturnType<typeof billingVisualForDay>): string | null {
  if (!billVis) return null;
  if (billVis === 'paid') return TimelineTokens.dotPaid;
  if (isToday) return TimelineTokens.dotDue;
  return TimelineTokens.dotPending;
}

/** Non–color-only cue on calendar cells (parent row already has full a11y label). */
export function billingMarkerGlyph(billVis: ReturnType<typeof billingVisualForDay>): string | null {
  if (billVis === 'due') return 'D';
  if (billVis === 'paid') return 'P';
  if (billVis === 'review') return '!';
  return null;
}

export function amountColorForStatus(status: string): { color: string } {
  if (status === 'paid') return { color: TimelineTokens.amountPaid };
  if (status === 'due') return { color: TimelineTokens.amountOwe };
  return { color: TimelineTokens.amountPending };
}
