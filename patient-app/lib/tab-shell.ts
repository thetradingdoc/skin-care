/**
 * P7.01 / P7.02 — Authenticated 5-tab shell + capture hide policy.
 * Calendar | Shelf | Track | Progress | Profile
 */

export const TAB_SHELL_ORDER = Object.freeze([
  'calendar',
  'shelf',
  'track',
  'progress',
  'account',
] as const);

export type TabShellRoute = (typeof TAB_SHELL_ORDER)[number];

/** Profile tab uses the existing `account` route file. */
export const TAB_SHELL_LABELS: Readonly<Record<TabShellRoute, string>> = Object.freeze({
  calendar: 'Calendar',
  shelf: 'Shelf',
  track: 'Track',
  progress: 'Progress',
  account: 'Profile',
});

/**
 * Routes that are an active capture transaction — tab bar must hide.
 * Includes stack routes outside `(tabs)` and any future nested capture paths.
 */
const CAPTURE_TRANSACTION_RE =
  /(?:^|\/)(?:track|journal|routine)\/capture(?:\/|$|\?)|(?:^|\/)scan-entry(?:\/|$|\?)|(?:^|\/)onboarding\/scan(?:\/|$|\?)|(?:^|\/)capture(?:\/|$)/i;

export function shouldHideTabBar(pathname: string | null | undefined): boolean {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return CAPTURE_TRANSACTION_RE.test(p);
}

export function isTabShellRoute(name: string): name is TabShellRoute {
  return (TAB_SHELL_ORDER as readonly string[]).includes(name);
}
