'use strict';

const VALID_CONDITION_TAGS = new Set([
  'calm',
  'breaking_out',
  'dry',
  'oily',
  'irritated',
  'dry_patches',
  'puffy',
]);

const FLARE_TAGS = new Set(['breaking_out', 'irritated']);

const TAG_LABELS = {
  calm: 'Calm',
  breaking_out: 'Breaking out',
  dry: 'Dry',
  oily: 'Oily',
  irritated: 'Irritated',
  dry_patches: 'Dry patches',
  puffy: 'Puffy',
};

function normalizeConditionTags(raw) {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = raw.split(',').map((s) => s.trim());
    }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((t) => String(t).trim().toLowerCase().replace(/\s+/g, '_')).filter((t) => VALID_CONDITION_TAGS.has(t)))];
}

function primaryConditionLabel(tags) {
  const normalized = normalizeConditionTags(tags);
  if (!normalized.length) return null;
  const flare = normalized.find((t) => FLARE_TAGS.has(t));
  if (flare) return TAG_LABELS[flare] || flare;
  return TAG_LABELS[normalized[0]] || normalized[0];
}

function isFlareDay(tags) {
  return normalizeConditionTags(tags).some((t) => FLARE_TAGS.has(t));
}

module.exports = {
  VALID_CONDITION_TAGS,
  FLARE_TAGS,
  TAG_LABELS,
  normalizeConditionTags,
  primaryConditionLabel,
  isFlareDay,
};
