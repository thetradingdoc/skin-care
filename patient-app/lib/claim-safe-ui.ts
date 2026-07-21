/**
 * G-CLAIM — claim-safe UI gate for the App Store binary.
 * Conflict / Hard-no / verdict / V3 insight screens stay in the repo but must not render
 * when this flag is off. Default OFF (claim-safe). Opt-in only via EXPO_PUBLIC_CONFLICT_VERDICT_UI=1.
 */
export function isConflictVerdictUiEnabled(): boolean {
  const raw = String(process.env.EXPO_PUBLIC_CONFLICT_VERDICT_UI || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/** Inverse helper for copy/CTA branches. */
export function isClaimSafeUiMode(): boolean {
  return !isConflictVerdictUiEnabled();
}
