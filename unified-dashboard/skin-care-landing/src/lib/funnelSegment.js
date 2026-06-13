export const FUNNEL_SEGMENT = {
  REACTIVE_MINIMAL: 'reactive_minimal',
  DIARY_FIRST: 'diary_first',
  ROUTINE_READY: 'routine_ready',
  WATCH_ONLY: 'watch_only',
};

/** @param {Record<string, unknown> | null | undefined} quickCheck */
export function getFunnelSegment(quickCheck, watchOnly = false) {
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

export function isDiarySegment(segment) {
  return (
    segment === FUNNEL_SEGMENT.REACTIVE_MINIMAL ||
    segment === FUNNEL_SEGMENT.DIARY_FIRST ||
    segment === FUNNEL_SEGMENT.WATCH_ONLY
  );
}

export function getRevealCtaLabel(segment) {
  switch (segment) {
    case FUNNEL_SEGMENT.REACTIVE_MINIMAL:
      return 'Continue tracking your skin →';
    case FUNNEL_SEGMENT.DIARY_FIRST:
      return 'Start your photo log →';
    case FUNNEL_SEGMENT.WATCH_ONLY:
      return 'Continue your journal →';
    case FUNNEL_SEGMENT.ROUTINE_READY:
      return 'Build my routine →';
    default:
      return 'Continue your journal →';
  }
}

export function getJourneyModesForSegment(segment) {
  if (segment === FUNNEL_SEGMENT.ROUTINE_READY) {
    return { modes: ['routine'], primary: 'routine' };
  }
  return { modes: ['watch'], primary: 'watch' };
}
