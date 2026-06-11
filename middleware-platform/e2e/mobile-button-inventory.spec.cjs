'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  MOCK_PRODUCT_ID,
  bootstrapMobileSession,
  stubMobileAppApis,
} = require('./helpers/mobile-app-mocks.cjs');

const RESULTS_PATH = path.join(__dirname, '..', 'playwright.mobile-button-inventory.json');
const PARTIAL_DIR = path.join(__dirname, '..', '.cache', 'button-inventory');

const BUTTON_GROUPS = {
  tabBar: [
    { screen: 'Tab bar', button: 'Today', action: 'Navigate to Today tab', route: '/app/(tabs)/today', label: 'Today', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?today/ },
    { screen: 'Tab bar', button: 'Progress', action: 'Navigate to Progress tab', route: '/app/(tabs)/today', label: 'Progress', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?progress/ },
    { screen: 'Tab bar', button: 'Scan', action: 'Navigate to Scan tab', route: '/app/(tabs)/today', label: 'Scan', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
    { screen: 'Tab bar', button: 'Plan', action: 'Navigate to Plan tab', route: '/app/(tabs)/today', label: 'Plan', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?plan/ },
    { screen: 'Tab bar', button: 'Profile', action: 'Navigate to Account tab', route: '/app/(tabs)/today', label: 'Profile', role: 'tab', expectUrl: /\/app\/(\(tabs\)\/)?account/ },
  ],
  today: [
    { screen: 'Today', button: 'Conflicts chip', action: 'Open Scan tab', route: '/app/(tabs)/today', label: 'Conflicts', expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
    { screen: 'Today', button: 'See all (photo history)', action: 'Open Progress', route: '/app/(tabs)/today', label: 'See all', expectUrl: /\/app\/(\(tabs\)\/)?progress/ },
    { screen: 'Today', button: 'More about this phase', action: 'Toggle phase notes', route: '/app/(tabs)/today', label: /more about this phase/i, expectText: /hide phase details/i },
    { screen: 'Today', button: "Take today's photo (FAB)", action: 'Open capture flow', route: '/app/(tabs)/today', label: /take today'?s photo/i, expectUrl: /\/app\/routine\/capture/ },
    { screen: 'Today', button: 'Complete skin profile banner', action: 'Open bio calibration', route: '/app/(tabs)/today', label: /complete your skin profile/i, skip: true, skipReason: 'Hidden when bio profile_complete=true in mock' },
  ],
  progressScanPlan: [
    { screen: 'Progress', button: 'Open journal timeline', action: 'Open timeline tab', route: '/app/(tabs)/progress', label: /open journal timeline/i, expectUrl: /\/app\/(\(tabs\)\/)?timeline/ },
    { screen: 'Scan', button: 'or search by name', action: 'Open manual add modal', route: '/app/(tabs)/scan', label: /search by name/i, expectText: /add by name/i },
    { screen: 'Scan', button: 'Add product (FAB)', action: 'Open manual add modal', route: '/app/(tabs)/scan', label: 'Add product', expectText: /add by name/i },
    { screen: 'Scan', button: 'Shelf product row', action: 'Open verdict', route: '/app/(tabs)/scan', label: 'Retinol 0.3%', expectUrl: new RegExp(`/app/verdict/${MOCK_PRODUCT_ID}`) },
    { screen: 'Scan', button: 'Allow camera', action: 'Request camera permission', route: '/app/(tabs)/scan', label: /allow camera/i, skip: true, skipReason: 'Camera permission varies in headless Chromium' },
    { screen: 'Plan', button: 'Scan header link', action: 'Open Scan tab', route: '/app/(tabs)/plan', label: /scan/i, expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
  ],
  account: [
    { screen: 'Account', button: 'Edit skin profile', action: 'Open bio calibration', route: '/app/(tabs)/account', label: /edit skin profile/i, expectUrl: /\/app\/onboarding\/bio-calibration/ },
    { screen: 'Account', button: 'Subscribe', action: 'Start Stripe checkout', route: '/app/(tabs)/account', label: /^subscribe$/i, skip: true, skipReason: 'Opens external Stripe via WebBrowser' },
    { screen: 'Account', button: 'Bills & receipts', action: 'Open money tab', route: '/app/(tabs)/account', label: /bills & receipts/i, expectUrl: /\/app\/(\(tabs\)\/)?money/ },
    { screen: 'Account', button: 'Change program', action: 'Open routine pick', route: '/app/(tabs)/account', label: /change program/i, expectUrl: /\/app\/routine\/pick/ },
    { screen: 'Account', button: 'Sign out', action: 'Clear session → sign-in', route: '/app/(tabs)/account', label: /sign out/i, expectUrl: /\/app\/sign-in/ },
  ],
  signIn: [
    { screen: 'Sign-in', button: 'Go back', action: 'Return to landing', route: '/app/sign-in', label: /go back/i, expectUrl: /\/$/, noSession: true },
    { screen: 'Sign-in', button: 'Send code', action: 'Advance to OTP step', route: '/app/sign-in', label: /send code/i, expectText: /enter code/i, noSession: true, setup: 'fillEmail' },
    { screen: 'Sign-in', button: 'Use a different email', action: 'Reset to email step', route: '/app/sign-in', label: /different email/i, noSession: true, setup: 'otpStep' },
  ],
  bioVerdict: [
    { screen: 'Bio calibration', button: 'Acne condition chip', action: 'Select condition', route: '/app/onboarding/bio-calibration', label: 'Acne' },
    { screen: 'Bio calibration', button: 'Continue', action: 'Advance step', route: '/app/onboarding/bio-calibration', label: /^continue$/i, expectText: /prescription actives/i },
    { screen: 'Verdict', button: 'Share', action: 'Share verdict', route: `/app/verdict/${MOCK_PRODUCT_ID}`, label: /^share$/i },
    { screen: 'Verdict', button: "Don't use it", action: 'Remove from shelf → Scan', route: `/app/verdict/${MOCK_PRODUCT_ID}`, label: /don'?t use it/i, expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
    { screen: 'Verdict', button: 'Keep anyway', action: 'Keep on shelf → Scan', route: `/app/verdict/${MOCK_PRODUCT_ID}`, label: /keep anyway/i, expectUrl: /\/app\/(\(tabs\)\/)?scan/ },
  ],
  bioBack: [
    { screen: 'Bio calibration', button: 'Back', action: 'Previous step', route: '/app/onboarding/bio-calibration', label: /^back$/i, setup: 'onStep2', skip: true, skipReason: 'Flaky step navigation in headless web export' },
  ],
  routine: [
    { screen: 'Routine pick', button: 'Acne program card', action: 'Select program', route: '/app/routine/pick', label: /acne care plan/i, useText: true },
    { screen: 'Routine pick', button: 'Start tracking', action: 'Create template → Today', route: '/app/routine/pick', label: /start tracking/i, setup: 'selectAcneProgram', expectUrl: /\/app\/(\(tabs\)\/)?today/ },
    { screen: 'Routine capture', button: 'Cancel', action: 'Navigate back', route: '/app/routine/capture', label: /^cancel$/i },
    { screen: 'Routine capture', button: 'Allow camera', action: 'Request permission', route: '/app/routine/capture', label: /allow camera/i, skip: true, skipReason: 'Camera permission varies in headless Chromium' },
  ],
  legacyTabs: [
    { screen: 'Timeline', button: 'Photos tab', action: 'Switch to photos view', route: '/app/(tabs)/timeline', label: /^photos$/i },
    { screen: 'Timeline', button: 'Calendar tab', action: 'Switch to calendar view', route: '/app/(tabs)/timeline', label: /^calendar$/i },
    { screen: 'Timeline', button: 'List tab', action: 'Switch to list view', route: '/app/(tabs)/timeline', label: /^list$/i },
    { screen: 'Timeline', button: 'Documents tab', action: 'Switch to documents view', route: '/app/(tabs)/timeline', label: /^documents$/i },
    { screen: 'Money', button: 'Capture receipt or bill', action: 'Open scan entry', route: '/app/(tabs)/money', label: /capture receipt or bill/i, expectUrl: /\/app\/scan-entry/ },
    { screen: 'Home', button: 'First capture CTA', action: 'Open scan entry', route: '/app/(tabs)/home', label: 'First capture', setup: 'emptyBilling', expectUrl: /\/app\/scan-entry/ },
    { screen: 'Insights', button: 'Manage plan', action: 'No-op stub', route: '/app/(tabs)/insights', label: /manage plan/i, skip: true, skipReason: 'Intentional no-op stub in code' },
    { screen: 'Insights', button: 'Sign out', action: 'Sign out → home', route: '/app/(tabs)/insights', label: /sign out/i, expectUrl: /\/app\/(\(tabs\)\/)?home/ },
    { screen: 'Explore', button: 'Open checkout chat', action: 'Open checkout chat', route: '/app/(tabs)/explore', label: /open checkout chat/i, expectUrl: /\/app\/checkout-chat/ },
  ],
  billingCapture: [
    { screen: 'Scan entry', button: 'Scan receipt', action: 'Open capture-scan', route: '/app/scan-entry', label: /scan receipt/i, expectUrl: /\/app\/capture-scan/ },
    { screen: 'Scan entry', button: 'Upload EOB/PDF', action: 'Open capture-upload', route: '/app/scan-entry', label: /upload eob/i, expectUrl: /\/app\/capture-upload/ },
    { screen: 'Scan entry', button: 'Add bill manually', action: 'Open manual bill', route: '/app/scan-entry', label: /add bill manually/i, expectUrl: /\/app\/capture-manual-bill/ },
    { screen: 'Scan entry', button: 'Add payment manually', action: 'Open manual payment', route: '/app/scan-entry', label: /add payment manually/i, expectUrl: /\/app\/capture-manual-payment/ },
    { screen: 'Scan entry', button: 'Close', action: 'Close modal', route: '/app/scan-entry', label: /^close$/i },
    { screen: 'Capture scan', button: 'Close', action: 'Close screen', route: '/app/capture-scan', label: /^close$/i },
    { screen: 'Capture upload', button: 'Choose file', action: 'File picker', route: '/app/capture-upload', label: /choose file/i, skip: true, skipReason: 'Native file picker not automatable in headless web' },
    { screen: 'Capture manual bill', button: 'Save bill', action: 'Save manual bill', route: '/app/capture-manual-bill', label: /save bill/i },
    { screen: 'Capture manual bill', button: 'Cancel', action: 'Cancel form', route: '/app/capture-manual-bill', label: /^cancel$/i },
    { screen: 'Capture manual payment', button: 'Save payment', action: 'Save manual payment', route: '/app/capture-manual-payment', label: /save payment/i },
    { screen: 'Capture complete', button: 'Open timeline', action: 'Open timeline tab', route: '/app/capture-complete', label: /open timeline/i, expectUrl: /\/app\/(\(tabs\)\/)?timeline/ },
    { screen: 'Checkout chat', button: 'Pay without chat', action: 'Skip chat checkout', route: '/app/checkout-chat', label: /pay without chat/i, skip: true, skipReason: 'Opens external Stripe checkout' },
  ],
  checkoutUnsigned: [
    { screen: 'Checkout chat', button: 'Go to Home', action: 'Navigate home tab', route: '/app/checkout-chat', label: /go to home/i, setup: 'checkoutClearSession', expectUrl: /\/app\/(\(tabs\)\/)?home/ },
  ],
  onboardingLegacy: [
    { screen: 'Onboarding scan', button: 'Skip for now', action: 'Skip to concerns', route: '/app/onboarding/scan', label: /skip for now/i, expectUrl: /\/app\/onboarding\/concerns/ },
    { screen: 'Onboarding concerns', button: 'Not sure — skip', action: 'Skip to signup', route: '/app/onboarding/concerns', label: /not sure/i, expectUrl: /\/app\/onboarding\/signup/ },
  ],
  onboardingConcerns: [
    { screen: 'Onboarding concerns', button: 'Continue', action: 'Save concerns → signup', route: '/app/onboarding/concerns', label: /^continue$/i, setup: 'selectConcern', expectUrl: /\/app\/onboarding\/signup/ },
  ],
  appointmentsLegacy: [
    { screen: 'Appointments (legacy)', button: 'Send verification code', action: 'Send OTP', route: '/app/(tabs)/index', label: /send verification code/i, noSession: true, skip: true, skipReason: 'Legacy index hidden tab; Expo web may mount today instead of index route' },
    { screen: 'Appointments (legacy)', button: 'Sign out', action: 'Sign out', route: '/app/(tabs)/index', label: /sign out/i, skip: true, skipReason: 'Index redirects to Today when session + template exist' },
  ],
};

const EXISTING_SPEC_RESULTS = [
  { screen: 'Sign-in', button: 'Go back', action: 'Return to landing', route: '/app/sign-in', result: 'pass', source: 'consumer-sign-in.spec.cjs' },
  { screen: 'Sign-in', button: 'Send code', action: 'Advance to OTP step', route: '/app/sign-in', result: 'pass', source: 'consumer-sign-in-otp.spec.cjs' },
  { screen: 'Sign-in', button: 'Continue', action: 'Verify OTP → routine pick', route: '/app/sign-in', result: 'pass', source: 'consumer-sign-in-otp.spec.cjs' },
  { screen: 'Verdict', button: 'Keep anyway', action: 'Keep on shelf → Scan', route: `/app/verdict/${MOCK_PRODUCT_ID}`, result: 'pass', source: 'conflict-engine-mobile.spec.cjs' },
  { screen: 'Scan', button: 'Page load', action: 'Scan hub renders', route: '/app/(tabs)/scan', result: 'partial', source: 'conflict-engine-mobile.spec.cjs' },
  { screen: 'Onboarding', button: 'Build my routine', action: 'Reveal → concerns', route: '/app/onboarding/reveal', result: 'partial', source: 'skin-age-journey.spec.cjs' },
  { screen: 'Onboarding', button: 'Upload selfie', action: 'Face read flow', route: '/app/onboarding/scan', result: 'partial', source: 'skin-age-journey.spec.cjs' },
];

async function runSetup(page, setup) {
  if (!setup) return;
  switch (setup) {
    case 'fillEmail':
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
      break;
    case 'otpStep':
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
      await page.getByRole('button', { name: /send code/i }).click();
      await expect(page.getByText(/enter code/i)).toBeVisible({ timeout: 10_000 });
      break;
    case 'selectCondition':
      await page.getByText('Acne').first().click();
      break;
    case 'onStep2':
      await page.getByText('Acne').first().click();
      await page.getByRole('button', { name: /^continue$/i }).click();
      break;
    case 'selectAcneProgram':
      await page.getByText(/acne care plan/i).first().click();
      break;
    case 'selectConcern':
      await page.getByRole('button', { name: /acne care plan/i }).click();
      break;
    case 'emptyBilling':
      break;
    case 'checkoutClearSession':
      await page.evaluate(() => {
        localStorage.removeItem('patient_session_id');
        localStorage.removeItem('patient_session_email');
        localStorage.removeItem('patient_api_base_url');
        localStorage.removeItem('api_base');
        localStorage.removeItem('patient_phone');
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 25_000 });
      break;
    default:
      break;
  }
}

async function ensureNoSession(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('patient_session_id');
    localStorage.removeItem('patient_session_email');
    localStorage.removeItem('patient_api_base_url');
    localStorage.removeItem('api_base');
    localStorage.removeItem('patient_phone');
  });
}

function mockOptionsForEntry(entry) {
  if (entry.setup === 'emptyBilling') return { emptyBilling: true };
  return {};
}

async function clickControl(page, entry) {
  const attempts = [
    () => (entry.role === 'tab' ? page.getByRole('tab', { name: entry.label }) : page.getByRole('button', { name: entry.label })),
    () => page.getByText(entry.label),
  ];
  for (const fn of attempts) {
    const loc = fn().first();
    try {
      await expect(loc).toBeVisible({ timeout: 8_000 });
      await loc.click({ timeout: 8_000 });
      return;
    } catch {
      /* try next strategy */
    }
  }
  throw new Error(`Control not found: ${entry.button}`);
}

async function waitForScreenReady(page, entry) {
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
  if (entry.route.includes('/today')) {
    await page
      .getByRole('button', { name: 'Conflicts' })
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/progress')) {
    await page
      .getByRole('button', { name: /open journal timeline/i })
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/account') && !entry.noSession) {
    await page
      .getByRole('button', { name: /edit skin profile/i })
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/concerns')) {
    await page
      .getByRole('button', { name: /acne care plan/i })
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/onboarding/scan')) {
    await page
      .getByRole('button', { name: /skip for now|allow camera/i })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/checkout-chat')) {
    await page
      .getByRole('button', { name: /go to home/i })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .catch(() => {});
  }
  if (entry.route.includes('/index')) {
    await page
      .getByText(/send verification code/i)
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
}

async function auditButton(page, entry) {
  const base = { screen: entry.screen, button: entry.button, action: entry.action, route: entry.route };
  if (entry.skip) return { ...base, result: 'skip', reason: entry.skipReason || 'Skipped' };

  try {
    if (entry.noSession) {
      await ensureNoSession(page);
    }
    await stubMobileAppApis(page, mockOptionsForEntry(entry));
    await page.goto(entry.route, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await waitForScreenReady(page, entry);
    await runSetup(page, entry.setup);
    await clickControl(page, entry);
    if (entry.expectUrl) await expect(page).toHaveURL(entry.expectUrl, { timeout: 15_000 });
    if (entry.expectText) await expect(page.getByText(entry.expectText).first()).toBeVisible({ timeout: 6_000 });
    return { ...base, result: 'pass' };
  } catch (err) {
    return { ...base, result: 'fail', error: (err.message || String(err)).slice(0, 240) };
  }
}

async function auditGroup(page, context, groupName, entries) {
  const results = [];
  fs.mkdirSync(PARTIAL_DIR, { recursive: true });
  const needsBootstrap =
    groupName === 'checkoutUnsigned' || entries.some((e) => !e.noSession && !e.skip);
  if (needsBootstrap) {
    await bootstrapMobileSession(context);
  }

  for (const entry of entries) {
    if (entry.noSession) {
      await ensureNoSession(page);
    }

    const row = await auditButton(page, entry);
    results.push(row);
    fs.writeFileSync(path.join(PARTIAL_DIR, `${groupName}.json`), JSON.stringify(results, null, 2));
  }
  return results;
}

function mergeResults() {
  const all = [];
  for (const name of Object.keys(BUTTON_GROUPS)) {
    const p = path.join(PARTIAL_DIR, `${name}.json`);
    if (fs.existsSync(p)) all.push(...JSON.parse(fs.readFileSync(p, 'utf8')));
  }
  const summary = {
    generated_at: new Date().toISOString(),
    total: all.length,
    pass: all.filter((r) => r.result === 'pass').length,
    fail: all.filter((r) => r.result === 'fail').length,
    skip: all.filter((r) => r.result === 'skip').length,
    existing_spec_coverage: EXISTING_SPEC_RESULTS,
    results: all,
  };
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2));
  return summary;
}

const ISOLATED_CONTEXT_GROUPS = new Set(['checkoutUnsigned', 'onboardingLegacy']);

test.describe('Mobile button inventory audit', () => {
  test.beforeAll(() => {
    fs.mkdirSync(PARTIAL_DIR, { recursive: true });
  });

  for (const [groupName, entries] of Object.entries(BUTTON_GROUPS)) {
    test(`audit: ${groupName}`, async ({ browser, page, context }) => {
      test.setTimeout(120_000);
      const isolated = ISOLATED_CONTEXT_GROUPS.has(groupName);
      const activeContext = isolated
        ? await browser.newContext({ viewport: { width: 390, height: 844 } })
        : context;
      const activePage = isolated ? await activeContext.newPage() : page;
      if (groupName === 'onboardingLegacy') {
        await activeContext.grantPermissions(['camera']);
      }
      try {
        await auditGroup(activePage, activeContext, groupName, entries);
      } finally {
        if (isolated) {
          await activeContext.close();
        }
      }
    });
  }

  test('merge JSON report', async () => {
    const summary = mergeResults();
    console.log(`Wrote ${RESULTS_PATH}`);
    console.log(`Pass: ${summary.pass} Fail: ${summary.fail} Skip: ${summary.skip}`);
    expect(summary.total).toBeGreaterThan(0);
  });
});
