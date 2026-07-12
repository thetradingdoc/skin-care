/**
 * Soft-launch feature flags for patient-app.
 * Flip JOURNAL_CAPTURE_ENABLED only after JOURNAL_MODE_STANDALONE=1 in prod.
 */
export const JOURNAL_CAPTURE_ENABLED = false;
// TODO: flip to true when JOURNAL_MODE_STANDALONE=1 confirmed in prod.
