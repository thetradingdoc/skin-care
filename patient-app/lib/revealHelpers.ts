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

export function fitzDisplay(fitzpatrick?: string, fitSkinTone?: string) {
  const f = String(fitzpatrick || '').trim();
  let short = 'Fitz';
  if (/VI/i.test(f)) short = 'Fitz VI';
  else if (/\bV\b/i.test(f)) short = 'Fitz V';
  else if (/IV/i.test(f)) short = 'Fitz IV';
  else if (/III/i.test(f)) short = 'Fitz III';
  else if (/I-II/i.test(f)) short = 'Fitz I-II';
  else if (f) short = f.startsWith('Fitz') ? f : `Fitz ${f}`;

  const tone = String(fitSkinTone || '').toLowerCase();
  let toneLine = fitzpatrickToneLabel(fitSkinTone, fitzpatrick);
  let skinLine = '';
  if (tone === 'dark' || tone === 'deep' || /VI/i.test(f) || /\bV\b/i.test(f)) {
    if (!toneLine || toneLine === 'dark tone') toneLine = 'deep tone';
    skinLine = 'dark skin';
  }
  return { short, toneLine, skinLine };
}

const SYNTHETIC_COPY: Record<string, string> = {
  acne: 'Visible breakouts detected in your photo.',
  hyperpigmentation: 'Uneven tone or dark marks visible in your scan.',
  texture: 'Surface texture variation detected on your skin.',
  dryness: 'Signs of dryness visible in your photo.',
  redness: 'Redness or irritation visible in your scan.',
  pores: 'Visible pore openings detected.',
  dark_circles: 'Under-eye area shows visible signs in your scan.',
  oiliness: 'Oiliness detected in your photo.',
};

export type SyntheticFinding = {
  id: string;
  label: string;
  plain_language: string;
  severity: number;
  zones: string[];
};

export function concernScoresToFindingCards(
  concernScores: Record<string, number> | undefined,
): SyntheticFinding[] {
  if (!concernScores || typeof concernScores !== 'object') return [];
  return Object.entries(concernScores)
    .filter(([, score]) => Number(score) >= 1)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([key, severity]) => ({
      id: key,
      label: CONCERN_LABELS[key] || key.replace(/_/g, ' '),
      plain_language: SYNTHETIC_COPY[key] || 'Detected in your photo.',
      severity: Number(severity),
      zones: [],
    }));
}

export type ZoneOverlay = {
  key: string;
  dot: { left: string; top: string; color: string };
  line: { left: string; top: string; width: number; rotate: number };
  label: { text: string; top: string; right?: string; left?: string };
};

export function buildZoneOverlays(
  findings: Array<{ id?: string; label?: string; severity?: number; zones?: string[] }>,
  centroids: Record<string, { x: number; y: number }>,
): ZoneOverlay[] {
  const overlays: ZoneOverlay[] = [];
  const seen = new Set<string>();
  for (const f of findings || []) {
    if (String(f.id || '').includes('poor_lighting')) continue;
    for (const zone of f.zones || []) {
      const c = centroids[zone];
      if (!c) continue;
      const key = `${f.id}-${zone}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const xPct = c.x * 100;
      const yPct = c.y * 100;
      const labelRight = c.x < 0.55;
      overlays.push({
        key,
        dot: {
          left: `${xPct}%`,
          top: `${yPct}%`,
          color: SEV_COLORS[f.severity ?? 1] || '#888780',
        },
        line: {
          left: `${xPct + (labelRight ? 3 : -3)}%`,
          top: `${yPct + 0.5}%`,
          width: 36 + (zone.length % 4) * 4,
          rotate: labelRight ? -10 : 10,
        },
        label: {
          text: f.label || zone.replace(/_/g, ' '),
          top: `${Math.max(8, yPct - 6)}%`,
          right: labelRight ? '4%' : undefined,
          left: labelRight ? undefined : '4%',
        },
      });
    }
  }
  return overlays;
}

export function scanInsightText(
  scanSummary?: string,
  positiveObservations?: string[],
): string | null {
  const summary = String(scanSummary || '').trim();
  if (!summary) return null;
  const positive = Array.isArray(positiveObservations) ? String(positiveObservations[0] || '') : '';
  if (positive && summary.toLowerCase().includes(positive.toLowerCase().slice(0, 24))) return null;
  return summary;
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
