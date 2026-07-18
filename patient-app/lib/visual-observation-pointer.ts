/**
 * Named-zone visual pointer — client contract mirror of
 * middleware visual-observation-pointer.js.
 *
 * Structurally incapable of carrying percentages/scores: TypeScript omits those
 * fields, and parseVisualPointer strips anything not on the allowlist.
 */

export const VISUAL_POINTER_ZONES = [
  'forehead',
  't_zone',
  'left_cheek',
  'right_cheek',
  'nose',
  'chin',
  'perioral',
  'under_eye',
  'temples',
  'neck',
] as const;

export type VisualPointerZone = (typeof VISUAL_POINTER_ZONES)[number];

/** Only these keys may exist on a pointer the UI will render. */
export type VisualPointer = {
  zones: VisualPointerZone[];
  zone_labels: string[];
  labeled: 'ai_suggestion';
  not_diagnosis: true;
  text?: string;
  compare_group_id?: string;
};

const ZONE_SET = new Set<string>(VISUAL_POINTER_ZONES);

const FORBIDDEN_SCORE_KEY = /percent|_pct$|^pct_|score|moisture|wrinkle|heatmap|composite|apparent_age|health_score|concern_score/i;

/**
 * Approximate face-landmark anchors (normalized 0–1 over a portrait face fill).
 * Not model pixel coords — labeled approximate in the UI.
 */
export const FACE_ZONE_LAYOUT: Record<
  VisualPointerZone,
  { cx: number; cy: number; rx: number; ry: number }
> = {
  forehead: { cx: 0.5, cy: 0.2, rx: 0.28, ry: 0.11 },
  t_zone: { cx: 0.5, cy: 0.38, rx: 0.16, ry: 0.26 },
  left_cheek: { cx: 0.28, cy: 0.5, rx: 0.13, ry: 0.13 },
  right_cheek: { cx: 0.72, cy: 0.5, rx: 0.13, ry: 0.13 },
  nose: { cx: 0.5, cy: 0.46, rx: 0.09, ry: 0.11 },
  chin: { cx: 0.5, cy: 0.74, rx: 0.15, ry: 0.1 },
  perioral: { cx: 0.5, cy: 0.64, rx: 0.17, ry: 0.09 },
  under_eye: { cx: 0.5, cy: 0.36, rx: 0.3, ry: 0.07 },
  temples: { cx: 0.5, cy: 0.3, rx: 0.4, ry: 0.09 },
  neck: { cx: 0.5, cy: 0.9, rx: 0.2, ry: 0.08 },
};

export const APPROXIMATE_REGION_CAPTION = 'approximate region — AI suggests';

export function parseVisualPointer(raw: unknown): VisualPointer | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_SCORE_KEY.test(key)) return null;
    if (typeof obj[key] === 'number') return null;
    if (typeof obj[key] === 'string' && /\d+\s*%/.test(obj[key] as string)) return null;
  }

  const zones = (Array.isArray(obj.zones) ? obj.zones : [])
    .map((z) => String(z))
    .filter((z): z is VisualPointerZone => ZONE_SET.has(z));

  const zone_labels = (Array.isArray(obj.zone_labels) ? obj.zone_labels : [])
    .map((z) => String(z).trim())
    .filter(Boolean)
    .slice(0, 12);

  if (!zones.length && !zone_labels.length) return null;

  return {
    zones,
    zone_labels:
      zone_labels.length > 0
        ? zone_labels
        : zones.map((z) => z.replace(/_/g, ' ')),
    labeled: 'ai_suggestion',
    not_diagnosis: true,
    text: obj.text != null ? String(obj.text).slice(0, 2000) : undefined,
    compare_group_id:
      obj.compare_group_id != null ? String(obj.compare_group_id) : undefined,
  };
}

export function visualPointerFromDraft(draft: Record<string, unknown>): VisualPointer | null {
  return parseVisualPointer(draft.visual_pointer);
}
