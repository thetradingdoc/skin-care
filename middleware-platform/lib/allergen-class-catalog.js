'use strict';

/**
 * TOUCH-055 — Chip / freeform → ingredient class IDs used by evaluate hard_no.
 */

const ALLERGEN_CLASSES = [
  {
    id: 'acrylates',
    label: 'acrylates',
    aliases: ['acrylate', 'acrylates', 'cyanoacrylate', 'ethylhexyl acrylate'],
    patterns: [/acrylate/i, /cyanoacrylate/i],
  },
  {
    id: 'fragrance',
    label: 'fragrance',
    aliases: ['fragrance', 'parfum', 'perfume', 'fragrance_mix'],
    patterns: [/fragrance/i, /\bparfum\b/i, /\bperfume\b/i, /limonene/i, /linalool/i],
  },
  {
    id: 'essential_oils',
    label: 'essential oils',
    aliases: ['essential_oils', 'essential oils', 'essential-oil', 'eo'],
    patterns: [/essential\s*oil/i, /\blavandula\b/i, /\bmentha\b/i, /\bcitrus\s+aurantium\b/i],
  },
  {
    id: 'alcohol',
    label: 'alcohol',
    aliases: ['alcohol', 'ethanol', 'denatured alcohol', 'sd alcohol'],
    patterns: [/\balcohol\b/i, /\bethanol\b/i, /denat\.?\s*alcohol/i, /\bsd\s*alcohol\b/i],
  },
];

const BY_ID = new Map(ALLERGEN_CLASSES.map((c) => [c.id, c]));

function normalizeClassToken(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/** Map chip/freeform label → catalog class id (or normalized slug if unknown). */
function resolveAllergenClassId(rawClass, rawLabel) {
  const tokens = [rawClass, rawLabel]
    .map((t) => normalizeClassToken(t))
    .filter(Boolean);
  for (const token of tokens) {
    if (BY_ID.has(token)) return token;
    for (const cls of ALLERGEN_CLASSES) {
      if (cls.aliases.some((a) => normalizeClassToken(a) === token)) return cls.id;
      if (cls.patterns.some((re) => re.test(String(rawLabel || rawClass || '')))) return cls.id;
    }
  }
  // Phrase match on original text
  const blob = `${rawClass || ''} ${rawLabel || ''}`.trim();
  for (const cls of ALLERGEN_CLASSES) {
    if (cls.patterns.some((re) => re.test(blob))) return cls.id;
  }
  return tokens[0] || '';
}

function getAllergenClass(id) {
  return BY_ID.get(String(id || '').toLowerCase()) || null;
}

function classMatchesBlob(classId, blob) {
  const cls = getAllergenClass(classId);
  const text = String(blob || '');
  if (!text) return false;
  if (cls) return cls.patterns.some((re) => re.test(text));
  // Unknown class: substring match on normalized tokens
  const token = normalizeClassToken(classId).replace(/_/g, ' ');
  if (!token || token.length < 3) return false;
  return text.toLowerCase().includes(token);
}

function classMatchesIngredientIds(classId, ingredientIds) {
  const ids = (ingredientIds || []).map((id) => String(id || '').toLowerCase());
  if (!ids.length) return false;
  const blob = ids.join(' | ');
  return classMatchesBlob(classId, blob);
}

module.exports = {
  ALLERGEN_CLASSES,
  resolveAllergenClassId,
  getAllergenClass,
  classMatchesBlob,
  classMatchesIngredientIds,
  normalizeClassToken,
};
