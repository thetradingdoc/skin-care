/**
 * Skin health dimensions (0–100, higher = healthier).
 * Prefer API health_scores from vision; fallback derives from concern_scores (0–3).
 *
 * Fallback mapping:
 * - Hydration: dryness, redness
 * - Clarity: acne, pores, oiliness
 * - Evenness: hyperpigmentation, texture
 * - Barrier: dryness, redness
 */

export const HEALTH_SCORE_KEYS = ['hydration', 'clarity', 'evenness', 'barrier'];

export const HEALTH_SCORE_LABELS = {
  hydration: 'Hydration',
  clarity: 'Clarity',
  evenness: 'Evenness',
  barrier: 'Barrier',
};

const DIMENSION_WEIGHTS = {
  hydration: { dryness: 1, redness: 0.5 },
  clarity: { acne: 1, pores: 0.8, oiliness: 0.5 },
  evenness: { hyperpigmentation: 1, texture: 0.8 },
  barrier: { dryness: 1, redness: 1 },
};

const NEUTRAL_SCORE = 75;

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function dimensionFromConcerns(concernScores, weights) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const severity = Number(concernScores[key]) || 0;
    if (severity > 0) {
      totalWeight += weight;
      weightedSum += weight * (100 - severity * 25);
    }
  }
  if (totalWeight === 0) return NEUTRAL_SCORE;
  return clampScore(weightedSum / totalWeight);
}

export function computeHealthScoresFromConcerns(concernScores = {}) {
  const scores = {};
  for (const key of HEALTH_SCORE_KEYS) {
    scores[key] = dimensionFromConcerns(concernScores, DIMENSION_WEIGHTS[key]);
  }
  return scores;
}

function hasAnyApiScore(healthScores) {
  if (!healthScores || typeof healthScores !== 'object') return false;
  return HEALTH_SCORE_KEYS.some((key) => {
    const n = Number(healthScores[key]);
    return Number.isFinite(n);
  });
}

export function resolveHealthScores(faceRead) {
  const api = faceRead?.health_scores;
  if (hasAnyApiScore(api)) {
    const fallback = computeHealthScoresFromConcerns(faceRead?.concern_scores ?? {});
    const out = {};
    for (const key of HEALTH_SCORE_KEYS) {
      const clamped = clampScore(api[key]);
      out[key] = clamped != null ? clamped : fallback[key];
    }
    return out;
  }
  return computeHealthScoresFromConcerns(faceRead?.concern_scores ?? {});
}

export function meterColor(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '#888780';
  if (n >= 70) return '#1D9E75';
  if (n >= 40) return '#EF9F27';
  return '#E24B4A';
}
