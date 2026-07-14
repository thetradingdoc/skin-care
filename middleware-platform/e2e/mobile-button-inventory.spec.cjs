'use strict';

/**
 * v3 IA button inventory — Home | Track | Scan | Progress | Profile.
 * Also see scripts/playwright-mobile-full-audit.cjs for full screenshot package.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  bootstrapMobileSession,
  stubMobileAppApis,
} = require('./helpers/mobile-app-mocks.cjs');
const { BUTTON_GROUPS } = require('./mobile-button-groups-v3.cjs');

const AUDIT_DIR = path.join(__dirname, '..', '..', 'todos', 'pending', 'mobile-ux-audit-2026-07-14');
const RESULTS_PATH = path.join(AUDIT_DIR, 'button-inventory-results-playwright.json');
const LEGACY_RESULTS_PATH = path.join(__dirname, '..', 'playwright.mobile-button-inventory.json');
const PARTIAL_DIR = path.join(__dirname, '..', '.cache', 'button-inventory');

const EXISTING_SPEC_RESULTS = [
  { screen: 'Sign-in', button: 'Send code', action: 'Advance to OTP step', route: '/app/sign-in', result: 'pass', source: 'consumer-sign-in-otp.spec.cjs' },
  { screen: 'Sign-in', button: 'Continue', action: 'Verify OTP', route: '/app/sign-in', result: 'pass', source: 'consumer-sign-in-otp.spec.cjs' },
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
    case 'selectAcneProgram':
      await page.getByText(/acne care plan/i).first().click();
      break;
    case 'selectConcern':
      await page.getByRole('button', { name: /acne care plan/i }).click().catch(async () => {
        await page.getByText(/acne/i).first().click();
      });
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

async function clickControl(page, entry) {
  const attempts = [
    () => (entry.role === 'tab' ? page.getByRole('tab', { name: entry.label }) : page.getByRole('button', { name: entry.label })),
    () => page.getByText(entry.label).first(),
  ];
  for (const fn of attempts) {
    const loc = fn().first();
    try {
      await expect(loc).toBeVisible({ timeout: 8_000 });
      await loc.click({ timeout: 8_000 });
      return;
    } catch {
      /* try next */
    }
  }
  throw new Error(`Control not found: ${entry.button}`);
}

async function waitForScreenReady(page, entry) {
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
  if (entry.route.includes('/account') && !entry.noSession) {
    await page
      .getByRole('button', { name: /edit skin profile|sign out/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }
}

async function auditButton(page, entry) {
  const base = { screen: entry.screen, button: entry.button, action: entry.action, route: entry.route };
  if (entry.skip) return { ...base, result: 'skip', reason: entry.skipReason || 'Skipped' };

  try {
    if (entry.noSession) await ensureNoSession(page);
    await stubMobileAppApis(page, {
      journeyModes: ['watch', 'routine'],
      hasTemplate: true,
      bioComplete: true,
    });
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
  const needsBootstrap = entries.some((e) => !e.noSession && !e.skip);
  if (needsBootstrap) {
    await bootstrapMobileSession(context, { journeyModes: ['watch', 'routine'], withSpot: true });
  }

  for (const entry of entries) {
    if (entry.noSession) await ensureNoSession(page);
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
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(summary, null, 2));
  fs.writeFileSync(LEGACY_RESULTS_PATH, JSON.stringify(summary, null, 2));
  return summary;
}

const ISOLATED_CONTEXT_GROUPS = new Set(['onboardingLegacy', 'signIn']);

test.describe('Mobile button inventory audit (v3 IA)', () => {
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
        if (isolated) await activeContext.close();
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
