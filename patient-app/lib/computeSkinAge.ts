/**
 * Weighted skin age from face age + visible concern scores.
 */
const WEIGHTS: Record<string, number> = {
  hyperpigmentation: 3,
  texture: 3,
  dryness: 2,
  redness: 1,
  acne: 1,
  pores: 1,
  dark_circles: 1,
  oiliness: 1,
};

const MAX_PENALTY = 15;

export function computeSkinAge(
  faceAge: number | null | undefined,
  concernScores: Record<string, number> = {},
): number | null {
  const base = Number(faceAge);
  if (!Number.isFinite(base)) return null;

  const maxPossible = Object.values(WEIGHTS).reduce((a, b) => a + b, 0) * 3;
  let actual = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const score = Number(concernScores[key]);
    if (Number.isFinite(score) && score > 0) {
      actual += weight * score;
    }
  }
  const penalty = maxPossible > 0 ? Math.round((actual / maxPossible) * MAX_PENALTY) : 0;
  return Math.round(base + penalty);
}
