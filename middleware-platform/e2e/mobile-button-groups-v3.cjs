'use strict';

/**
 * v3 IA button groups for mobile inventory (Home | Track | Scan | Progress | Profile).
 * Full audit also writes todos/pending/mobile-ux-audit-2026-07-14/button-inventory-results.json
 */
const { MOCK_PRODUCT_ID } = require('./helpers/mobile-app-mocks.cjs');

const BUTTON_GROUPS = {
  tabBar: [
    { screen: 'Tab bar', button: 'Home', action: 'Navigate to Home', route: '/app/(tabs)/home', label: 'Home', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?home/ },
    { screen: 'Tab bar', button: 'Track', action: 'Navigate to Track', route: '/app/(tabs)/home', label: 'Track', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?track/ },
    { screen: 'Tab bar', button: 'Scan', action: 'Navigate to Scan', route: '/app/(tabs)/home', label: 'Scan', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
    { screen: 'Tab bar', button: 'Progress', action: 'Navigate to Progress', route: '/app/(tabs)/home', label: 'Progress', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?progress/ },
    { screen: 'Tab bar', button: 'Profile', action: 'Navigate to Profile', route: '/app/(tabs)/home', label: 'Profile', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?account/ },
  ],
  home: [
    { screen: 'Home', button: 'Log progress photo', action: 'Open capture', route: '/app/(tabs)/home', label: /log progress photo|take progress photo/i, expectUrl: /\/app\/routine\/capture/ },
    { screen: 'Home', button: 'See all photo history', action: 'Open Progress', route: '/app/(tabs)/home', label: /see all/i, expectUrl: /\/app\/(\(tabs\)\/)?progress/, skip: true, skipReason: 'Only visible when photo thumbs exist' },
  ],
  progressScan: [
    { screen: 'Progress', button: 'Compare', action: 'Open compare', route: '/app/(tabs)/progress', label: /compare/i, expectUrl: /\/app\/compare/ },
    { screen: 'Scan', button: 'or search by name', action: 'Open manual add', route: '/app/(tabs)/scan', label: /search by name/i, expectText: /add by name|product/i },
    { screen: 'Scan', button: 'Add product', action: 'Open manual add FAB', route: '/app/(tabs)/scan', label: /add product/i },
    { screen: 'Scan', button: 'Shelf product row', action: 'Open verdict', route: '/app/(tabs)/scan', label: 'Retinol 0.3%', expectUrl: new RegExp(`/app/verdict/${MOCK_PRODUCT_ID}`) },
    { screen: 'Scan', button: 'Allow camera', action: 'Request camera', route: '/app/(tabs)/scan', label: /allow camera/i, skip: true, skipReason: 'Camera permission varies in headless Chromium' },
  ],
  account: [
    { screen: 'Profile', button: 'Edit skin profile', action: 'Open bio calibration', route: '/app/(tabs)/account', label: /edit skin profile/i, expectUrl: /\/app\/onboarding\/bio-calibration/ },
    { screen: 'Profile', button: 'Subscribe', action: 'Start Stripe checkout', route: '/app/(tabs)/account', label: /^subscribe$/i, skip: true, skipReason: 'Opens external Stripe via WebBrowser' },
    { screen: 'Profile', button: 'Change program', action: 'Open routine pick', route: '/app/(tabs)/account', label: /change program/i, expectUrl: /\/app\/routine\/pick/ },
    { screen: 'Profile', button: 'Sign out', action: 'Clear session → sign-in', route: '/app/(tabs)/account', label: /sign out/i, expectUrl: /\/app\/sign-in/ },
  ],
  signIn: [
    {
      screen: 'Sign-in',
      button: 'Go back',
      action: 'Intended in-app back; currently marketing home — expect fail-vs-product',
      route: '/app/sign-in',
      label: /go back/i,
      expectUrl: /myskinandcare\.com\/?$/,
      noSession: true,
    },
    { screen: 'Sign-in', button: 'Send code', action: 'Advance to OTP', route: '/app/sign-in', label: /send code/i, expectText: /enter code/i, noSession: true, setup: 'fillEmail' },
    { screen: 'Sign-in', button: 'Use a different email', action: 'Reset to email step', route: '/app/sign-in', label: /different email/i, noSession: true, setup: 'otpStep' },
  ],
  bioVerdict: [
    { screen: 'Bio calibration', button: 'Acne condition chip', action: 'Select condition', route: '/app/onboarding/bio-calibration', label: 'Acne' },
    { screen: 'Bio calibration', button: 'Continue', action: 'Advance step', route: '/app/onboarding/bio-calibration', label: /^continue$/i, expectText: /prescription|condition/i },
    { screen: 'Verdict', button: "Don't use it", action: 'Remove → Scan', route: `/app/verdict/${MOCK_PRODUCT_ID}`, label: /don'?t use it/i, expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
    { screen: 'Verdict', button: 'Keep anyway', action: 'Keep → Scan', route: `/app/verdict/${MOCK_PRODUCT_ID}`, label: /keep anyway/i, expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
  ],
  routine: [
    { screen: 'Routine pick', button: 'Acne program card', action: 'Select program', route: '/app/routine/pick', label: /acne care plan/i, useText: true },
    { screen: 'Routine pick', button: 'Start tracking', action: 'Create template → post-auth', route: '/app/routine/pick', label: /start tracking/i, setup: 'selectAcneProgram', expectUrl: /\/app\// },
    { screen: 'Routine capture', button: 'Cancel', action: 'Navigate back', route: '/app/routine/capture', label: /^cancel$/i },
    { screen: 'Routine capture', button: 'Allow camera', action: 'Request permission', route: '/app/routine/capture', label: /allow camera/i, skip: true, skipReason: 'Camera permission varies in headless Chromium' },
  ],
  onboardingLegacy: [
    { screen: 'Onboarding scan', button: 'Skip for now', action: 'Skip to concerns', route: '/app/onboarding/scan', label: /skip for now/i, expectUrl: /\/app\/onboarding\/concerns/ },
    { screen: 'Onboarding concerns', button: 'Not sure — skip', action: 'Skip to signup', route: '/app/onboarding/concerns', label: /not sure/i, expectUrl: /\/app\/onboarding\/signup/ },
    { screen: 'Onboarding concerns', button: 'Continue', action: 'Save concerns → signup', route: '/app/onboarding/concerns', label: /^continue$/i, setup: 'selectConcern', expectUrl: /\/app\/onboarding\/signup/ },
  ],
};

module.exports = { BUTTON_GROUPS };
