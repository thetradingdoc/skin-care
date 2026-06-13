import { patientGet, patientPatch, patientUploadForm } from '@/lib/patient-api';
import { appendUploadToForm, uriToUploadFile } from '@/lib/upload-uri';

export type JournalConditionTag =
  | 'calm'
  | 'breaking_out'
  | 'dry'
  | 'oily'
  | 'irritated'
  | 'dry_patches'
  | 'puffy';

export type JournalEntry = {
  entry_id: string;
  entry_date: string;
  photo_url: string | null;
  condition_tags: JournalConditionTag[];
  primary_condition: string | null;
  note: string | null;
  has_photo: boolean;
  source?: string;
  day_mode?: string;
};

export type JournalTimelineDay = {
  date: string;
  photo_url: string | null;
  condition_tags: JournalConditionTag[];
  primary_condition: string | null;
  note: string | null;
  has_photo: boolean;
  source?: string;
};

export type TriggerInsight = {
  label: string;
  body: string;
  confidence: number;
  type: 'negative' | 'positive';
  keyword?: string;
};

export type JournalImprovements = {
  redness_pct: number;
  breakouts_pct: number;
  texture_pct: number;
  hydration_pct: number;
};

export async function postJournalDailyPhoto(params: {
  photoUri: string;
  entryDate?: string;
  conditionTags?: JournalConditionTag[];
  note?: string;
}): Promise<JournalEntry> {
  const form = new FormData();
  const file = await uriToUploadFile(params.photoUri, 'journal.jpg', 'image/jpeg');
  appendUploadToForm(form, file, 'journal.jpg');
  if (params.entryDate) form.append('entry_date', params.entryDate);
  if (params.conditionTags?.length) {
    form.append('condition_tags', JSON.stringify(params.conditionTags));
  }
  if (params.note) form.append('note', params.note);

  const data = await patientUploadForm('/api/patient/journal/daily-photo', form);
  if (!data?.success) throw new Error(data?.error || 'journal_photo_failed');
  return data as JournalEntry;
}

export async function patchJournalDailyEntry(params: {
  entryDate?: string;
  conditionTags?: JournalConditionTag[];
  note?: string | null;
}): Promise<JournalEntry> {
  const data = await patientPatch('/api/patient/journal/daily-entry', {
    entry_date: params.entryDate,
    condition_tags: params.conditionTags,
    note: params.note,
  });
  if (!data?.success) throw new Error(data?.error || 'journal_checkin_failed');
  return data as JournalEntry;
}

export async function fetchJournalTimeline(days = 8): Promise<JournalTimelineDay[]> {
  const data = await patientGet(`/api/patient/journal/timeline?days=${days}`);
  return Array.isArray(data?.days) ? data.days : [];
}

export async function fetchTriggerInsights(): Promise<{
  ready: boolean;
  insights: TriggerInsight[];
  entry_count?: number;
}> {
  const data = await patientGet('/api/patient/journal/trigger-insights');
  return {
    ready: Boolean(data?.ready),
    insights: Array.isArray(data?.insights) ? data.insights : [],
    entry_count: data?.entry_count,
  };
}

export async function fetchJournalImprovements(): Promise<{
  ready: boolean;
  metrics: JournalImprovements | null;
  unlock_after_days?: number;
}> {
  const data = await patientGet('/api/patient/journal/improvements');
  return {
    ready: Boolean(data?.ready),
    metrics: data?.metrics ?? null,
    unlock_after_days: data?.unlock_after_days,
  };
}
