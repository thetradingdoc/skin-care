'use strict';

const { primaryConditionLabel } = require('./journal-condition-tags');

/**
 * Merge standalone journal entries with optional routine calendar days.
 * Journal row wins per date when both exist.
 */
function mergeJournalTimeline({ journalEntries = [], routineDays = [], issuePhotoUrl }) {
  const byDate = new Map();

  for (const day of routineDays) {
    if (!day?.date) continue;
    const hasMedia = Boolean(day.has_media || day.thumbnail_url || day.media_url);
    if (!hasMedia && !day.symptom_tags?.length) continue;
    byDate.set(day.date, {
      date: day.date,
      photo_url: day.thumbnail_url || day.media_url || null,
      condition_tags: Array.isArray(day.symptom_tags) ? day.symptom_tags : [],
      note: day.notes || null,
      has_photo: hasMedia,
      source: 'routine',
    });
  }

  for (const entry of journalEntries) {
    if (!entry?.entry_date) continue;
    const photoUrl =
      entry.photo_storage_ref && typeof issuePhotoUrl === 'function'
        ? issuePhotoUrl(entry.photo_storage_ref)
        : entry.photo_storage_ref || null;
    byDate.set(entry.entry_date, {
      date: entry.entry_date,
      photo_url: photoUrl,
      condition_tags: entry.condition_tags || [],
      note: entry.note || null,
      has_photo: Boolean(entry.photo_storage_ref),
      source: entry.source || 'standalone',
    });
  }

  return [...byDate.values()]
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((row) => ({
      ...row,
      primary_condition: primaryConditionLabel(row.condition_tags),
    }));
}

function enrichCalendarDayFromJournal(baseDay, journalEntry, issuePhotoUrl) {
  if (!journalEntry) return baseDay;
  const photoUrl =
    journalEntry.photo_storage_ref && typeof issuePhotoUrl === 'function'
      ? issuePhotoUrl(journalEntry.photo_storage_ref)
      : journalEntry.photo_storage_ref || baseDay.thumbnail_url || null;
  return {
    ...baseDay,
    has_entry: true,
    has_media: Boolean(photoUrl || baseDay.has_media),
    thumbnail_url: photoUrl || baseDay.thumbnail_url || null,
    media_url: photoUrl || baseDay.media_url || null,
    condition_tags: journalEntry.condition_tags || [],
    note: journalEntry.note || null,
    journal_entry_id: journalEntry.id,
    completion_score: baseDay.completion_score || (journalEntry.photo_storage_ref ? 100 : 50),
  };
}

module.exports = {
  mergeJournalTimeline,
  enrichCalendarDayFromJournal,
};
