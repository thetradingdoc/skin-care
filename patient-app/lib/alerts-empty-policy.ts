/**
 * P5.13 — Empty alerts never auto-redirect. Pure settle helper so the
 * bounce-to-Check regression is testable without mounting the screen.
 */

export type AlertsFeedSettle<T = unknown> = {
  empty: boolean;
  /** Always null after P5.13 — empty (or error) alerts never auto-navigate. */
  autoRedirectTo: null;
  alerts: T[];
};

/**
 * Settle an alerts feed payload. Empty lists render in place — no navigation.
 */
export function settleAlertsFeed<T = unknown>(list: unknown): AlertsFeedSettle<T> {
  const alerts = Array.isArray(list) ? (list as T[]) : [];
  if (!alerts.length) {
    return { empty: true, autoRedirectTo: null, alerts: [] };
  }
  return { empty: false, autoRedirectTo: null, alerts };
}

/** Explicit product lock — paired with ALERTS_HOME_DECISION on the API. */
export const ALERTS_EMPTY_NEVER_REDIRECTS = true as const;
