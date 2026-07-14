/**
 * TOUCH-042 — client severity rank helpers (mirror server).
 */
export type SeverityLevel = 'low' | 'some' | 'a_lot';
export type CalmFlag = 'yes' | 'no';

export function levelToRank(level: SeverityLevel | string | null | undefined): 1 | 2 | 3 | null {
  const v = String(level || '').toLowerCase();
  if (v === 'low') return 1;
  if (v === 'some') return 2;
  if (v === 'a_lot') return 3;
  return null;
}

export function scoreToLevel(score: number): SeverityLevel | null {
  if (!Number.isFinite(score) || score < 1 || score > 10) return null;
  if (score <= 3) return 'low';
  if (score <= 6) return 'some';
  return 'a_lot';
}

export const SEVERITY_LEVELS: SeverityLevel[] = ['low', 'some', 'a_lot'];
