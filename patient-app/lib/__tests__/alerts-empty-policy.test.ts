/**
 * P5.13 — empty alerts must never auto-redirect to Check.
 */
import { describe, expect, it } from 'vitest';

import {
  ALERTS_EMPTY_NEVER_REDIRECTS,
  settleAlertsFeed,
} from '@/lib/alerts-empty-policy';

describe('P5.13 alerts empty settle — no auto-redirect', () => {
  it('empty list renders in place: autoRedirectTo is null', () => {
    const settled = settleAlertsFeed([]);
    expect(settled.empty).toBe(true);
    expect(settled.autoRedirectTo).toBeNull();
    expect(settled.alerts).toEqual([]);
    expect(ALERTS_EMPTY_NEVER_REDIRECTS).toBe(true);
  });

  it('null/undefined feed also does not redirect', () => {
    expect(settleAlertsFeed(null).autoRedirectTo).toBeNull();
    expect(settleAlertsFeed(undefined).autoRedirectTo).toBeNull();
    expect(settleAlertsFeed(null).empty).toBe(true);
  });

  it('non-empty feed still never auto-redirects', () => {
    const settled = settleAlertsFeed([{ id: 'a1' }]);
    expect(settled.empty).toBe(false);
    expect(settled.autoRedirectTo).toBeNull();
    expect(settled.alerts).toHaveLength(1);
  });

  it('alerts.tsx load path does not call router.replace(CHECK) on empty', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(path.join(__dirname, '../../app/alerts.tsx'), 'utf8');
    expect(src).toMatch(/settleAlertsFeed/);
    expect(src).toMatch(/autoRedirectTo/);
    expect(src).toMatch(/testID="alerts-empty"/);
    // Old bounce pattern must stay gone from load/catch
    expect(src).not.toMatch(/if\s*\(\s*!list\.length\s*\)\s*\{\s*router\.replace\(CHECK_HREF\)/);
    expect(src).not.toMatch(/catch\s*\{[^}]*router\.replace\(CHECK_HREF\)/);
    // Optional intentional button may remain — must not be the empty auto-path
    expect(src).toMatch(/setEmpty\(true\)/);
  });
});
