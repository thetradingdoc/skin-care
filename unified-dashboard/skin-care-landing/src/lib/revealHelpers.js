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

export { CONCERN_LABELS, SEV_COLORS };
