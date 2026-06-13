'use strict';

const { isFlareDay, normalizeConditionTags } = require('../lib/journal-condition-tags');

const TRIGGER_KEYWORDS = [
  { key: 'makeup', label: 'Makeup', patterns: ['makeup', 'foundation', 'concealer', 'mascara'] },
  { key: 'stress', label: 'Stress', patterns: ['stress', 'anxious', 'anxiety', 'worried'] },
  { key: 'new_product', label: 'New product', patterns: ['new product', 'tried new', 'new moisturizer', 'new serum', 'new cream'] },
  { key: 'alcohol', label: 'Alcohol', patterns: ['alcohol', 'wine', 'beer', 'drank'] },
  { key: 'sugar', label: 'Sugar', patterns: ['sugar', 'sweet', 'dessert', 'candy'] },
  { key: 'late_night', label: 'Late nights', patterns: ['late night', 'slept late', 'lack of sleep', 'insomnia', 'tired'] },
  { key: 'cycle', label: 'Cycle', patterns: ['period', 'cycle', 'hormone', 'pms', 'menstrual'] },
];

const MIN_ENTRIES = 5;
const FLARE_WINDOW = 5;
const MATCH_THRESHOLD = 3;

function noteMatchesKeyword(note, patterns) {
  const text = String(note || '').toLowerCase();
  if (!text) return false;
  return patterns.some((p) => text.includes(p));
}

function computeTriggerInsights(entries) {
  const logged = (entries || []).filter(
    (e) =>
      e?.entry_date &&
      (e.photo_storage_ref ||
        (e.condition_tags && e.condition_tags.length) ||
        (e.note && String(e.note).trim())),
  );

  if (logged.length < MIN_ENTRIES) {
    return { ready: false, min_entries: MIN_ENTRIES, entry_count: logged.length, insights: [] };
  }

  const sorted = [...logged].sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)));
  const flareDays = sorted.filter((e) => isFlareDay(e.condition_tags)).slice(0, FLARE_WINDOW);

  if (flareDays.length < 2) {
    return { ready: true, entry_count: logged.length, insights: [] };
  }

  const insights = [];

  for (const { key, label, patterns } of TRIGGER_KEYWORDS) {
    let matches = 0;
    for (const day of flareDays) {
      const tagHit = normalizeConditionTags(day.condition_tags).includes(key);
      const noteHit = noteMatchesKeyword(day.note, patterns);
      if (tagHit || noteHit) matches += 1;
    }
    if (matches >= MATCH_THRESHOLD) {
      const totalFlare = flareDays.length;
      insights.push({
        label,
        body: `${matches} of your last ${totalFlare} breakout days may be linked to ${label.toLowerCase()}. Keep logging to confirm.`,
        confidence: Math.min(0.95, matches / totalFlare),
        type: 'negative',
        keyword: key,
      });
    }
  }

  const calmAfterSkip = sorted.find(
    (e, idx) =>
      idx > 0 &&
      normalizeConditionTags(e.condition_tags).includes('calm') &&
      noteMatchesKeyword(e.note, ['skipped makeup', 'no makeup']),
  );
  if (calmAfterSkip) {
    insights.push({
      label: 'Skipping makeup',
      body: 'You logged a calm day after skipping makeup — keep tracking to see if it holds.',
      confidence: 0.6,
      type: 'positive',
      keyword: 'skip_makeup',
    });
  }

  insights.sort((a, b) => b.confidence - a.confidence);
  return {
    ready: true,
    entry_count: logged.length,
    insights: insights.slice(0, 2),
  };
}

module.exports = {
  computeTriggerInsights,
  MIN_ENTRIES,
  TRIGGER_KEYWORDS,
};
