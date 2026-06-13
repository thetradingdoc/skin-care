export type FunnelSegment =
  | 'reactive_minimal'
  | 'diary_first'
  | 'routine_ready'
  | 'watch_only';

export const FUNNEL_SEGMENT = {
  REACTIVE_MINIMAL: 'reactive_minimal',
  DIARY_FIRST: 'diary_first',
  ROUTINE_READY: 'routine_ready',
  WATCH_ONLY: 'watch_only',
} as const satisfies Record<string, FunnelSegment>;

export type QuickCheckAnswers = {
  skin_feel?: string | null;
  routine_habit?: string | null;
  routine_times?: string[];
  recent_trigger?: string | null;
};

export function getFunnelSegment(
  quickCheck: QuickCheckAnswers | null | undefined,
  watchOnly = false,
): FunnelSegment {
  if (watchOnly) return FUNNEL_SEGMENT.WATCH_ONLY;
  const habit = quickCheck?.routine_habit;
  const feel = quickCheck?.skin_feel;
  if (habit === 'not_really' && feel === 'Irritated') {
    return FUNNEL_SEGMENT.REACTIVE_MINIMAL;
  }
  if (habit === 'yes_regularly' || habit === 'sometimes') {
    return FUNNEL_SEGMENT.ROUTINE_READY;
  }
  if (habit === 'not_really' || habit === 'starting_fresh') {
    return FUNNEL_SEGMENT.DIARY_FIRST;
  }
  return FUNNEL_SEGMENT.DIARY_FIRST;
}

export function isDiarySegment(segment: FunnelSegment): boolean {
  return (
    segment === FUNNEL_SEGMENT.REACTIVE_MINIMAL ||
    segment === FUNNEL_SEGMENT.DIARY_FIRST ||
    segment === FUNNEL_SEGMENT.WATCH_ONLY
  );
}

export function getJourneyModesForSegment(segment: FunnelSegment): {
  modes: ('watch' | 'routine')[];
  primary: 'watch' | 'routine';
} {
  if (segment === FUNNEL_SEGMENT.ROUTINE_READY) {
    return { modes: ['routine'], primary: 'routine' };
  }
  return { modes: ['watch'], primary: 'watch' };
}
