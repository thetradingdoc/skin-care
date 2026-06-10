import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IonName = ComponentProps<typeof Ionicons>['name'];

export type FindingIconStyle = {
  icon: IonName;
  bg: string;
  color: string;
};

const CONCERN_LABELS: Record<string, string> = {
  hyperpigmentation: 'Dark spots',
  texture: 'Texture',
  dryness: 'Dryness',
  redness: 'Redness',
  acne: 'Breakouts',
  pores: 'Pores',
  dark_circles: 'Under-eye',
  oiliness: 'Oiliness',
};

export const SEV_COLORS: Record<number, string> = {
  3: '#E24B4A',
  2: '#EF9F27',
  1: '#378ADD',
};

export function severityLabel(n: number | undefined): string {
  const s = Number(n);
  if (s >= 3) return 'Significant';
  if (s === 2) return 'Moderate';
  return 'Mild';
}

export function findingIcon(id: string | undefined): FindingIconStyle {
  const key = String(id || '').toLowerCase();
  if (key.includes('acne') || key.includes('breakout') || key.includes('pimple')) {
    return { icon: 'ellipse', bg: '#FCEBEB', color: '#A32D2D' };
  }
  if (key.includes('dry') || key.includes('barrier') || key.includes('flak')) {
    return { icon: 'water', bg: '#FAEEDA', color: '#854F0B' };
  }
  if (key.includes('pigment') || key.includes('pih') || key.includes('dark_mark')) {
    return { icon: 'color-palette', bg: '#FAEEDA', color: '#854F0B' };
  }
  if (key.includes('texture') || key.includes('rough')) {
    return { icon: 'grid', bg: '#FAEEDA', color: '#854F0B' };
  }
  if (key.includes('pore')) {
    return { icon: 'radio-button-off', bg: '#E6F1FB', color: '#185FA5' };
  }
  if (key.includes('redness') || key.includes('rosacea')) {
    return { icon: 'heart', bg: '#FCEBEB', color: '#A32D2D' };
  }
  if (key.includes('oily')) {
    return { icon: 'water-outline', bg: '#E1F5EE', color: '#0F6E56' };
  }
  if (key.includes('lighting') || key.includes('quality')) {
    return { icon: 'sunny', bg: '#F8F9FB', color: '#5F5E5A' };
  }
  return { icon: 'scan-outline', bg: '#F8F9FB', color: '#888780' };
}

export function concernFallbackChips(concernScores: Record<string, number> | undefined) {
  if (!concernScores || typeof concernScores !== 'object') return [];
  return Object.entries(concernScores)
    .filter(([, score]) => Number(score) >= 1)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([key, score]) => ({
      id: key,
      label: CONCERN_LABELS[key] || key.replace(/_/g, ' '),
      severity: Number(score),
    }));
}

export function zoneCentroids(zonePolygons: Record<string, number[][]> | undefined) {
  const result: Record<string, { x: number; y: number }> = {};
  for (const [zone, pts] of Object.entries(zonePolygons || {})) {
    if (!Array.isArray(pts) || !pts.length) continue;
    result[zone] = {
      x: pts.reduce((s, p) => s + (Number(p[0]) || 0), 0) / pts.length,
      y: pts.reduce((s, p) => s + (Number(p[1]) || 0), 0) / pts.length,
    };
  }
  return result;
}

export function fitzpatrickToneLabel(fitSkinTone?: string, fitzpatrick?: string): string {
  if (fitSkinTone) return `${fitSkinTone} tone`;
  const f = String(fitzpatrick || '');
  if (/V|VI/i.test(f)) return 'deep tone';
  if (/IV/i.test(f)) return 'medium-deep tone';
  return '';
}

export function isVisionFailed(faceRead: {
  vision_enabled?: boolean;
  vision_error?: string | null;
  findings?: unknown[];
  scan_summary?: string;
  concern_scores?: Record<string, number>;
} | null): boolean {
  if (!faceRead?.vision_enabled) return false;
  const findings = Array.isArray(faceRead.findings) ? faceRead.findings : [];
  const concernScores = faceRead.concern_scores ?? {};
  const allScoresZero = Object.values(concernScores).every((v) => (v ?? 0) === 0);
  const fallbackChips = findings.length ? [] : concernFallbackChips(concernScores);
  return Boolean(
    faceRead.vision_error ||
      (findings.length === 0 &&
        !faceRead.scan_summary &&
        allScoresZero &&
        fallbackChips.length === 0),
  );
}
