/**
 * PIH v2 / Skiñcare design tokens — SSOT for brand surfaces.
 * Wine ink + ground page; accent red for CTAs. No touche orange.
 */
export const V4DesignTokens = {
  color: {
    /** Accent CTA / Be bold / FAB center */
    red: '#E31919',
    redDeep: '#A30F0F',
    /** Brand ink / tab bar — Downloads --wine */
    wine: '#3D000B',
    /** Alias: brand ink (formerly near-black #0B0B0C) */
    black: '#3D000B',
    white: '#FFFFFF',
    /** Page ground — Downloads --ground */
    ground: '#F3F1EF',
    line: 'rgba(61,0,11,0.12)',
    lineStrong: 'rgba(61,0,11,0.22)',
    muted: 'rgba(61,0,11,0.55)',
    /** Downloads --green for success / Kelly attrib */
    green: '#4f8a5b',
    greenDark: '#356140',
  },
  font: {
    /** Poppins ExtraBold — Garet stand-in until licensed */
    display: 'Poppins_800ExtraBold',
    body: 'Manrope_400Regular',
    bodyMedium: 'Manrope_500Medium',
    bodySemiBold: 'Manrope_600SemiBold',
    bodyBold: 'Manrope_700Bold',
  },
  fab: {
    ringWidth: 4,
    centerDot: 10,
  },
} as const;

/** Retired brand oranges — keep listed so grep/tests can assert absence from brand surfaces. */
export const RETIRED_BRAND_ORANGES = ['#F7591F', '#ba200a', '#BA200A'] as const;
