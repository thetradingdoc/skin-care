'use strict';

const { isFlareDay, normalizeConditionTags } = require('../lib/journal-condition-tags');

const UNLOCK_AFTER_DAYS = 14;

function splitWeeks(entries, todayIso) {
  const sorted = [...entries].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  const today = new Date(`${todayIso}T12:00:00.000Z`);
  const weekAStart = new Date(today.getTime());
  weekAStart.setUTCDate(weekAStart.getUTCDate() - 6);
  const weekBStart = new Date(today.getTime());
  weekBStart.setUTCDate(weekBStart.getUTCDate() - 13);
  const weekBEnd = new Date(today.getTime());
  weekBEnd.setUTCDate(weekBEnd.getUTCDate() - 7);

  const inRange = (iso, start, end) => {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return d >= start && d <= end;
  };

  const recent = sorted.filter((e) => inRange(e.entry_date, weekAStart, today));
  const prior = sorted.filter((e) => inRange(e.entry_date, weekBStart, weekBEnd));
  return { recent, prior, all: sorted };
}

function tagRate(entries, predicate) {
  if (!entries.length) return 0;
  const hits = entries.filter((e) => predicate(e)).length;
  return hits / entries.length;
}

function pctDelta(priorRate, recentRate, invert = false) {
  if (priorRate === 0 && recentRate === 0) return 0;
  const raw = priorRate === 0 ? recentRate * 100 : ((recentRate - priorRate) / priorRate) * 100;
  const adjusted = invert ? -raw : raw;
  return Math.round(Math.max(-99, Math.min(99, adjusted)));
}

function computeJournalImprovements(entries, todayIso) {
  const logged = (entries || []).filter((e) => e?.entry_date);
  const uniqueDays = new Set(logged.map((e) => e.entry_date)).size;

  if (uniqueDays < 7) {
    return {
      ready: false,
      unlock_after_days: UNLOCK_AFTER_DAYS,
      entry_count: uniqueDays,
      metrics: null,
    };
  }

  const { recent, prior } = splitWeeks(logged, todayIso);

  const flareRecent = tagRate(recent, (e) => isFlareDay(e.condition_tags));
  const flarePrior = tagRate(prior, (e) => isFlareDay(e.condition_tags));
  const dryRecent = tagRate(recent, (e) =>
    normalizeConditionTags(e.condition_tags).some((t) => t === 'dry' || t === 'dry_patches'),
  );
  const dryPrior = tagRate(prior, (e) =>
    normalizeConditionTags(e.condition_tags).some((t) => t === 'dry' || t === 'dry_patches'),
  );
  const calmRecent = tagRate(recent, (e) => normalizeConditionTags(e.condition_tags).includes('calm'));
  const calmPrior = tagRate(prior, (e) => normalizeConditionTags(e.condition_tags).includes('calm'));

  return {
    ready: true,
    entry_count: uniqueDays,
    metrics: {
      redness_pct: pctDelta(flarePrior, flareRecent, true),
      breakouts_pct: pctDelta(flarePrior, flareRecent, true),
      texture_pct: pctDelta(dryPrior, dryRecent, true),
      hydration_pct: pctDelta(calmPrior, calmRecent, false),
    },
  };
}

module.exports = {
  computeJournalImprovements,
  UNLOCK_AFTER_DAYS,
};
