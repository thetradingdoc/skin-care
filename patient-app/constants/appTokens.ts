import { Fonts } from './theme';

/** Unified v3 + brand SSOT tokens (see docs/Brand/SKIN_AND_CARE_GUIDELINES.md). */
export const AppTokens = {
  color: {
    /** Consumer patient app + funnel page background (white; marketing cream remains in tokens.css). */
    pageBg: '#FFFFFF',
    cream: '#F8F3EA',
    card: '#FFFDF9',
    ink: '#1F2937',
    muted: '#6B7280',
    hint: '#9CA3AF',
    line: '#E9E2D6',
    brandBlue: '#314DB6',
    brandAccent: '#314DB6',
    accent: '#57BFD4',
    /** Caution / soft conflict (TOUCH-008) — reuse this hex; do not add a parallel "caution" color. */
    terracotta: '#C16E52',
    /** Safe verdict / bottle band (TOUCH-006). */
    safe: '#2F9E5C',
    /** Hard-no / allergen exclude (TOUCH-007) — visually distinct from terracotta caution. */
    hardNo: '#D93A3A',
    success: '#4F8A5B',
    danger: '#B42318',
    fabBg: '#111111',
    photoBg: '#1A1A1A',
    watchAmber: '#FAEEDA',
    watchAmberText: '#854F0B',
    routineGreen: '#E1F5EE',
    routineGreenText: '#085041',
    barrierGreat: '#1D9E75',
    barrierOk: '#EF9F27',
    barrierWarn: '#E24B4A',
    cardRed: '#FCEBEB',
    cardRedText: '#791F1F',
    cardAmber: '#FAEEDA',
    cardAmberText: '#633806',
    cardGreen: '#E1F5EE',
    cardGreenText: '#085041',
    infoBlue: '#E6F1FB',
    infoBlueText: '#185FA5',
  },
  font: {
    display: Fonts.serif,
    body: Fonts.sans,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 20,
    xl: 28,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
  },
  motion: {
    quickMs: 120,
    standardMs: 220,
  },
  minTap: 48,
} as const;
