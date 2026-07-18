/**
 * P7.04 — Capture shell routing 2a → 3 → 4 → 5 → 5b → 6.
 * Pure helpers so the path is testable without mounting screens.
 */

import type { Href } from 'expo-router';

import {
  CAPTURE_2A_HREF,
  CAPTURE_LOADING_HREF,
  CAPTURE_TAG_HREF,
  confirmHrefForTag,
  revealHrefForTag,
  thesisHrefForTag,
} from '@/constants/routes';

export { CAPTURE_LOADING_HREF };

export type CaptureFlowTag = 'skin' | 'bill' | 'rx' | 'mark' | 'lab' | 'other';

export const CAPTURE_FLOW_STEPS = ['2a', '3', '4', '5', '5b', '6'] as const;
export type CaptureFlowStep = (typeof CAPTURE_FLOW_STEPS)[number];

/** Canonical v10 path after a successful photo/upload. */
export function nextCaptureStep(step: CaptureFlowStep): CaptureFlowStep | null {
  const i = CAPTURE_FLOW_STEPS.indexOf(step);
  if (i < 0 || i >= CAPTURE_FLOW_STEPS.length - 1) return null;
  return CAPTURE_FLOW_STEPS[i + 1];
}

export function hrefForCaptureStep(step: CaptureFlowStep, tag: CaptureFlowTag = 'skin'): Href {
  switch (step) {
    case '2a':
      return CAPTURE_2A_HREF;
    case '3':
      return CAPTURE_TAG_HREF;
    case '4':
      return `${CAPTURE_LOADING_HREF}?tag=${encodeURIComponent(tag)}` as Href;
    case '5':
      return confirmHrefForTag(tag);
    case '5b':
      return revealHrefForTag(tag);
    case '6':
      return thesisHrefForTag(tag);
    default: {
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

/** Map UI tag chip labels to route tags (prescription → rx). */
export function mapCaptureTagChip(
  chip: 'skin' | 'bill' | 'prescription' | 'mark' | 'lab' | 'other',
): CaptureFlowTag {
  return chip === 'prescription' ? 'rx' : chip;
}
