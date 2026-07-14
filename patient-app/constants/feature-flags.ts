/**
 * Soft-launch feature flags for patient-app.
 * Flip JOURNAL_CAPTURE_ENABLED only after JOURNAL_MODE_STANDALONE=1 in prod.
 *
 * TOUCH-084 — Commerce CTAs stay off until middleware reports ready
 * (COMMERCE_CTAS_ENABLED=1 or seeded variant map). Client also checks /api/patient/commerce/status.
 */
export const JOURNAL_CAPTURE_ENABLED = true;

/** Local override only — runtime truth comes from commerce/status. */
export const COMMERCE_CTAS_LOCAL_OVERRIDE =
  String(process.env.EXPO_PUBLIC_COMMERCE_CTAS_ENABLED || '').toLowerCase() === '1' ||
  String(process.env.EXPO_PUBLIC_COMMERCE_CTAS_ENABLED || '').toLowerCase() === 'true';
