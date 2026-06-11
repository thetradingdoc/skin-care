/**
 * Skin health dimensions (0–100, higher = healthier).
 * Prefer API health_scores from vision; fallback derives from concern_scores (0–3).
 */

export const HEALTH_SCORE_KEYS = ['hydration', 'clarity', 'evenness', 'barrier'] as const;

export type HealthScoreKey = (typeof HEALTH_SCORE_KEYS)[number];

export type HealthScores = Record<HealthScoreKey, number>;

export const HEALTH_SCORE_LABELS: Record<HealthScoreKey, string> = {
  hydration: 'Hydration',
  clarity: 'Clarity',
  evenness: 'Evenness',
  barrier: 'Barrier',
};

const DIMENSION_WEIGHTS: Record<HealthScoreKey, Record<string, number>> = {
  hydration: { dryness: 1, redness: 0.5 },
  clarity: { acne: 1, pores: 0.8, oiliness: 0.5 },
  evenness: { hyperpigmentation: 1, texture: 0.8 },
  barrier: { dryness: 1, redness: 1 },
};

const NEUTRAL_SCORE = 75;

function clampScore(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function dimensionFromConcerns(
  concernScores: Record<string, number>,
  weights: Record<string, number>,
): number {
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
  return clampScore(weightedSum / totalWeight) ?? NEUTRAL_SCORE;
}

export function computeHealthScoresFromConcerns(
  concernScores: Record<string, number> = {},
): HealthScores {
  const scores = {} as HealthScores;
  for (const key of HEALTH_SCORE_KEYS) {
    scores[key] = dimensionFromConcerns(concernScores, DIMENSION_WEIGHTS[key]);
  }
  return scores;
}

function hasAnyApiScore(healthScores: Record<string, unknown> | undefined | null): boolean {
  if (!healthScores || typeof healthScores !== 'object') return false;
  return HEALTH_SCORE_KEYS.some((key) => Number.isFinite(Number(healthScores[key])));
}

type FaceReadLike = {
  health_scores?: Record<string, unknown>;
  concern_scores?: Record<string, number>;
};

export function resolveHealthScores(faceRead: FaceReadLike | null | undefined): HealthScores {
  const api = faceRead?.health_scores;
  if (hasAnyApiScore(api)) {
    const fallback = computeHealthScoresFromConcerns(faceRead?.concern_scores ?? {});
    const out = {} as HealthScores;
    for (const key of HEALTH_SCORE_KEYS) {
      const clamped = clampScore(api?.[key]);
      out[key] = clamped != null ? clamped : fallback[key];
    }
    return out;
  }
  return computeHealthScoresFromConcerns(faceRead?.concern_scores ?? {});
}

export function meterColor(value: number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '#888780';
  if (n >= 70) return '#1D9E75';
  if (n >= 40) return '#EF9F27';
  return '#E24B4A';
}
