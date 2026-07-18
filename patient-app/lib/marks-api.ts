/**
 * P7.24 / P7.25 — Marks APIs (P5.11 list + P5.12 compare_group timeline).
 * Must call these endpoints — never reimplement the query client-side.
 */

import { patientGet } from '@/lib/patient-api';

export const MARKS_LIST_API = '/api/patient/marks';
export const MARKS_COMPARE_API_PREFIX = '/api/patient/marks/compare-group/';

export type MarkListItem = {
  id: string;
  date?: string | null;
  body_location?: string | null;
  note?: string | null;
  compare_group_id?: string | null;
  media_url?: string | null;
};

export type MarksListPayload = {
  success?: boolean;
  marks: MarkListItem[];
};

export type CompareTimelineEntry = {
  id: string;
  date?: string | null;
  body_location?: string | null;
  media_url?: string | null;
  compare_group_id?: string | null;
  narrative?: null;
  /** Named-zone overlay only — never scores or AI narrative prose. */
  visual_pointer?: unknown;
};

export async function fetchMarksList(): Promise<MarksListPayload> {
  const data = await patientGet(MARKS_LIST_API);
  return {
    success: data?.success !== false,
    marks: Array.isArray(data?.marks) ? data.marks : [],
  };
}

export async function fetchCompareGroupTimeline(
  compareGroupId: string,
): Promise<{ success?: boolean; entries: CompareTimelineEntry[]; compare_group_id: string }> {
  const data = await patientGet(
    `${MARKS_COMPARE_API_PREFIX}${encodeURIComponent(compareGroupId)}`,
  );
  const entries = Array.isArray(data?.entries)
    ? data.entries
    : Array.isArray(data?.timeline)
      ? data.timeline
      : Array.isArray(data?.facts)
        ? data.facts
        : [];
  return {
    success: data?.success !== false,
    compare_group_id: String(data?.compare_group_id || compareGroupId),
    entries,
  };
}
