/**
 * P7.01 / P7.02 — 5-tab shell + hide during capture transaction.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  isTabShellRoute,
  shouldHideTabBar,
  TAB_SHELL_LABELS,
  TAB_SHELL_ORDER,
} from '@/lib/tab-shell';

describe('P7.01 Restore visible 5-tab shell', () => {
  it('locks Calendar Shelf Track Progress Profile order', () => {
    expect([...TAB_SHELL_ORDER]).toEqual([
      'calendar',
      'shelf',
      'track',
      'progress',
      'account',
    ]);
    expect(TAB_SHELL_LABELS.account).toBe('Profile');
    expect(TAB_SHELL_LABELS.calendar).toBe('Calendar');
    expect(isTabShellRoute('scan')).toBe(false);
    expect(isTabShellRoute('track')).toBe(true);
  });

  it('tab layout wires five visible tabs and hides scan/_journal', () => {
    const src = readFileSync(join(__dirname, '../../app/(tabs)/_layout.tsx'), 'utf8');
    expect(src).toMatch(/auth-shell-five-tabs/);
    expect(src).toMatch(/shouldHideTabBar/);
    expect(src).toMatch(/name="calendar"/);
    expect(src).toMatch(/name="shelf"/);
    expect(src).toMatch(/name="track"/);
    expect(src).toMatch(/name="progress"/);
    expect(src).toMatch(/name="account"/);
    expect(src).toMatch(/TAB_SHELL_LABELS\.account/);
    // Legacy camera-first hide-everything must stay retired
    expect(src).not.toMatch(/TOUCH-032/);
    expect(src).not.toMatch(/auth-shell-no-tab-bar/);
    // Non-shell screens stay addressable but not in the bar
    expect(src).toMatch(/name="scan"[\s\S]*href:\s*null/);
    expect(src).toMatch(/name="_journal"[\s\S]*href:\s*null/);
  });
});

describe('P7.02 Hide tab bar during active capture transaction only', () => {
  it('hides for track/journal/routine capture and scan-entry', () => {
    expect(shouldHideTabBar('/track/capture')).toBe(true);
    expect(shouldHideTabBar('/track/capture?spotId=abc')).toBe(true);
    expect(shouldHideTabBar('/journal/capture')).toBe(true);
    expect(shouldHideTabBar('/routine/capture')).toBe(true);
    expect(shouldHideTabBar('/scan-entry')).toBe(true);
    expect(shouldHideTabBar('/onboarding/scan')).toBe(true);
    expect(shouldHideTabBar('/capture/reveal/skin')).toBe(true);
    expect(shouldHideTabBar('/capture/reveal/bill')).toBe(true);
    expect(shouldHideTabBar('/capture')).toBe(true);
    expect(shouldHideTabBar('/capture/tag')).toBe(true);
    expect(shouldHideTabBar('/capture/loading')).toBe(true);
    expect(shouldHideTabBar('/capture/confirm/bill')).toBe(true);
    expect(shouldHideTabBar('/capture/thesis/skin')).toBe(true);
  });

  it('keeps tabs visible on the five shell routes', () => {
    expect(shouldHideTabBar('/calendar')).toBe(false);
    expect(shouldHideTabBar('/(tabs)/calendar')).toBe(false);
    expect(shouldHideTabBar('/shelf')).toBe(false);
    expect(shouldHideTabBar('/track')).toBe(false);
    expect(shouldHideTabBar('/(tabs)/track')).toBe(false);
    expect(shouldHideTabBar('/progress')).toBe(false);
    expect(shouldHideTabBar('/account')).toBe(false);
    expect(shouldHideTabBar('/alerts')).toBe(false);
    expect(shouldHideTabBar('/check')).toBe(false);
  });

  it('does not treat spot detail as a capture transaction', () => {
    expect(shouldHideTabBar('/track/spot_123')).toBe(false);
  });
});
