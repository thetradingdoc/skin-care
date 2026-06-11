const CONCERN_LABELS = {
  hyperpigmentation: 'Dark spots',
  texture: 'Texture',
  dryness: 'Dryness',
  redness: 'Redness',
  acne: 'Breakouts',
  pores: 'Pores',
  dark_circles: 'Under-eye',
  oiliness: 'Oiliness',
};

const SEV_COLORS = { 3: '#E24B4A', 2: '#EF9F27', 1: '#378ADD' };

export function severityLabel(n) {
  const s = Number(n);
  if (s >= 3) return 'Significant';
  if (s === 2) return 'Moderate';
  return 'Mild';
}

export function findingIcon(id) {
  const key = String(id || '').toLowerCase();
  if (key.includes('acne') || key.includes('breakout') || key.includes('pimple')) {
    return { icon: 'ti-circle-dot', cls: 'fi-r', color: '#A32D2D' };
  }
  if (key.includes('dry') || key.includes('barrier') || key.includes('flak')) {
    return { icon: 'ti-droplet', cls: 'fi-a', color: '#854F0B' };
  }
  if (key.includes('pigment') || key.includes('pih') || key.includes('dark_mark')) {
    return { icon: 'ti-palette', cls: 'fi-a', color: '#854F0B' };
  }
  if (key.includes('texture') || key.includes('rough')) {
    return { icon: 'ti-grain', cls: 'fi-a', color: '#854F0B' };
  }
  if (key.includes('pore')) {
    return { icon: 'ti-circle', cls: 'fi-b', color: '#185FA5' };
  }
  if (key.includes('redness') || key.includes('rosacea')) {
    return { icon: 'ti-heart', cls: 'fi-r', color: '#A32D2D' };
  }
  if (key.includes('oily')) {
    return { icon: 'ti-droplet', cls: 'fi-t', color: '#0F6E56' };
  }
  if (key.includes('lighting') || key.includes('quality')) {
    return { icon: 'ti-sun', cls: 'fi-gray', color: '#5F5E5A' };
  }
  return { icon: 'ti-scan', cls: 'fi-gray', color: '#888780' };
}

export function concernFallbackChips(concernScores) {
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

export function zoneCentroids(zonePolygons) {
  const result = {};
  for (const [zone, pts] of Object.entries(zonePolygons || {})) {
    if (!Array.isArray(pts) || !pts.length) continue;
    result[zone] = {
      x: pts.reduce((s, p) => s + (Number(p[0]) || 0), 0) / pts.length,
      y: pts.reduce((s, p) => s + (Number(p[1]) || 0), 0) / pts.length,
    };
  }
  return result;
}

export function fitzpatrickToneLabel(fitSkinTone, fitzpatrick) {
  if (fitSkinTone) return `${fitSkinTone} tone`;
  const f = String(fitzpatrick || '');
  if (/V|VI/i.test(f)) return 'deep tone';
  if (/IV/i.test(f)) return 'medium-deep tone';
  return '';
}

export function fitzDisplay(fitzpatrick, fitSkinTone) {
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

const SYNTHETIC_COPY = {
  acne: 'Visible breakouts detected in your photo.',
  hyperpigmentation: 'Uneven tone or dark marks visible in your scan.',
  texture: 'Surface texture variation detected on your skin.',
  dryness: 'Signs of dryness visible in your photo.',
  redness: 'Redness or irritation visible in your scan.',
  pores: 'Visible pore openings detected.',
  dark_circles: 'Under-eye area shows visible signs in your scan.',
  oiliness: 'Oiliness detected in your photo.',
};

export function concernScoresToFindingCards(concernScores) {
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

export function buildZoneOverlays(findings, centroids) {
  const overlays = [];
  const seen = new Set();
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
          color: SEV_COLORS[f.severity] || '#888780',
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

export function scanInsightText(scanSummary, positiveObservations) {
  const summary = String(scanSummary || '').trim();
  if (!summary) return null;
  const positive = Array.isArray(positiveObservations) ? String(positiveObservations[0] || '') : '';
  if (positive && summary.toLowerCase().includes(positive.toLowerCase().slice(0, 24))) return null;
  return summary;
}

export function isVisionFailed(faceRead) {
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

export { CONCERN_LABELS, SEV_COLORS };
