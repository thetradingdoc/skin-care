'use strict';

/** Cumulative actives load → barrier health index (0–100, higher = healthier barrier). */

const ACTIVE_WEIGHTS = {
  retinol: 35,
  tretinoin: 40,
  retinal: 35,
  adapalene: 38,
  tazarotene: 40,
  'glycolic acid': 28,
  'lactic acid': 22,
  'mandelic acid': 18,
  'salicylic acid': 30,
  'ascorbic acid': 15,
  'benzoyl peroxide': 32,
};

const BHA_ALIASES = [
  { re: /salicylic acid|beta hydroxy|bha\b/i, id: 'salicylic acid' },
  { re: /willow bark|salix/i, id: 'salicylic acid' },
  { re: /betaine salicylate/i, id: 'salicylic acid' },
];

function normId(id) {
  return String(id || '')
    .replace(/^cosing:/, '')
    .trim()
    .toLowerCase();
}

function collectIngredientIds(slots) {
  const ids = [];
  for (const slot of slots || []) {
    if (Array.isArray(slot.steps)) {
      for (const st of slot.steps) {
        for (const id of st.ingredient_ids || []) {
          const n = normId(id);
          if (n) ids.push(n);
        }
      }
    } else if (Array.isArray(slot.ingredient_ids)) {
      for (const id of slot.ingredient_ids) {
        const n = normId(id);
        if (n) ids.push(n);
      }
    }
  }
  return ids;
}

function detectClassOverloads(slots, productLabels = []) {
  const alerts = [];
  const bhaSources = new Set();

  for (const label of productLabels) {
    const text = String(label || '');
    for (const alias of BHA_ALIASES) {
      if (alias.re.test(text)) {
        bhaSources.add(text.slice(0, 80) || 'BHA product');
        break;
      }
    }
  }

  const ids = collectIngredientIds(slots);
  const bhaCount = ids.filter((id) => id === 'salicylic acid').length;
  const effectiveBha = Math.max(bhaCount, bhaSources.size);

  if (effectiveBha >= 2) {
    alerts.push({
      id: 'class_overload:bha',
      severity: effectiveBha >= 3 ? 'high' : 'moderate',
      ingredient_a: 'salicylic acid',
      ingredient_b: 'salicylic acid',
      interaction_type: 'barrier_disruption',
      notes: `${effectiveBha} BHA sources detected — cumulative exfoliation may overload your barrier.`,
      reason_codes: ['class_overload:bha'],
      verdict: effectiveBha >= 3 ? 'avoid' : 'caution',
    });
  }

  return alerts;
}

function computeLoadPercent(slots) {
  const ids = collectIngredientIds(slots);
  let load = 0;
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    load += ACTIVE_WEIGHTS[id] || 0;
  }
  return Math.min(200, load);
}

/**
 * @returns {{ barrier_friction_index: number, barrier_label: string, load_percent: number, class_overloads: object[] }}
 */
function computeBarrierMetrics(slots, extraConflicts = []) {
  const load = computeLoadPercent(slots);
  const conflictPenalty = (extraConflicts || []).filter((c) => c.severity === 'critical').length * 12
    + (extraConflicts || []).filter((c) => c.severity === 'high').length * 8
    + (extraConflicts || []).filter((c) => c.severity === 'moderate').length * 4;

  const totalLoad = Math.min(200, load + conflictPenalty);
  const bfi = Math.max(0, Math.min(100, Math.round(100 - totalLoad * 0.55)));

  let barrier_label = 'safe';
  if (bfi < 60) barrier_label = 'critical';
  else if (bfi < 80) barrier_label = 'elevated';

  return {
    barrier_friction_index: bfi,
    barrier_label,
    load_percent: totalLoad,
  };
}

module.exports = {
  ACTIVE_WEIGHTS,
  BHA_ALIASES,
  detectClassOverloads,
  computeBarrierMetrics,
  collectIngredientIds,
  normId,
};
