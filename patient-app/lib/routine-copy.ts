import type { RoutineDayMode } from '@/lib/routine-day-mode';

export function todayScreenTitle(dayMode: RoutineDayMode): string {
  if (dayMode === 'today') return 'Today';
  if (dayMode === 'backfill') return "Add yesterday's photo";
  return 'Past day';
}

export function layeringUnavailableCopy(): string {
  return graphUnavailableCopy();
}

export function graphUnavailableCopy(): string {
  return 'Ingredient compatibility data is temporarily unavailable.';
}

export function celebrateBannerCopy(): string {
  return 'Day logged — see your progress on Progress.';
}
