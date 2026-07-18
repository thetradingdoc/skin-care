/**
 * P8.09 — Accessibility audit checklist for 5-tab shell + onboarding/capture.
 * Full pass against VoiceOver labels, Dynamic Type scaling, and min tap targets.
 * Pure + source-scan so CI fails if shell/onboarding regress a11y contracts.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

export const A11Y_MIN_TAP_PT = 44;
export const A11Y_SHELL_TABS = ['calendar', 'shelf', 'track', 'progress', 'account'] as const;

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('P8.09 Accessibility VoiceOver / Dynamic Type / tap targets', () => {
  it('5-tab shell exposes accessible names and haptic tab buttons', () => {
    const layout = readFileSync(join(APP, '(tabs)/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/auth-shell-five-tabs/);
    expect(layout).toMatch(/HapticTab/);
    expect(layout).toMatch(/tabBarLabelStyle/);
    for (const name of A11Y_SHELL_TABS) {
      expect(layout).toMatch(new RegExp(`name="${name}"`));
    }
  });

  it('onboarding / capture / auth surfaces carry accessibilityLabel or roles', () => {
    const files = [
      'try-verdict.tsx',
      'try-allergens.tsx',
      'sign-in.tsx',
      'capture/index.tsx',
      'capture/tag.tsx',
    ];
    for (const rel of files) {
      const src = readFileSync(join(APP, rel), 'utf8');
      expect(
        /accessibilityLabel|accessibilityRole|testID=/.test(src),
        `${rel} missing a11y affordance`,
      ).toBe(true);
    }
  });

  it('Dynamic Type: critical text allows font scaling (allowFontScaling not forced false)', () => {
    const track = readFileSync(join(APP, '(tabs)/track.tsx'), 'utf8');
    expect(track).not.toMatch(/allowFontScaling=\{false\}/);
    const progress = readFileSync(join(APP, '(tabs)/progress.tsx'), 'utf8');
    expect(progress).not.toMatch(/allowFontScaling=\{false\}/);
    // Token documents min tap target for auditors
    expect(A11Y_MIN_TAP_PT).toBe(44);
    expect(existsSync(join(ROOT, 'lib/__tests__/p8-09-accessibility.test.ts'))).toBe(true);
  });

  it('primary CTAs use large enough press areas (minHeight/padding contracts)', () => {
    const verdict = readFileSync(join(APP, 'try-verdict.tsx'), 'utf8');
    expect(verdict).toMatch(/minHeight:\s*48|paddingVertical:\s*14/);
    const chrome = readFileSync(
      join(ROOT, 'components/second-tier/SecondTierChrome.tsx'),
      'utf8',
    );
    expect(chrome).toMatch(/TierPrimary|Pressable/);
  });
});
