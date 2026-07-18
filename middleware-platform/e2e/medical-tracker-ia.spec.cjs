/**
 * P8.10 — Playwright medical-tracker IA journey (live + contracts).
 *
 * Live: BASE_URL=https://host (no trailing /app). Routes use /app/...
 *   BASE_URL=https://app.trytouche.com npx playwright test e2e/medical-tracker-ia.spec.cjs
 *   BASE_URL=http://127.0.0.1:4180 npx playwright test e2e/medical-tracker-ia.spec.cjs
 *
 * Required live journeys:
 *   1) skin-only
 *   2) bill-only
 *   3) multi-tag skin+Rx
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').replace(/\/$/, '');

function appUrl(p) {
  const rel = p.startsWith('/') ? p : `/${p}`;
  return `${BASE}/app${rel === '/' ? '' : rel}`;
}

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

async function assertNotUnmatched(page, label) {
  const body = await page.locator('body').innerText();
  expect(body, `${label}: unmatched route`).not.toMatch(/Unmatched Route/i);
}

test.describe('P8.10 medical tracker IA E2E', () => {
  test('journey contracts: skin, bill, multi-tag orchestration exist', () => {
    const orch = fs.readFileSync(
      path.join(__dirname, '../services/capture-orchestration/index.js'),
      'utf8',
    );
    expect(orch).toMatch(/orchestrateMultiCapture|orchestrateCapture/);
    const cold = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/index.tsx'),
      'utf8',
    );
    expect(cold).toMatch(/WELCOME_HREF/);
    expect(cold).not.toMatch(/TRY_VERDICT_HREF/);
    const progress = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/(tabs)/progress.tsx'),
      'utf8',
    );
    expect(progress).toMatch(/ProgressAlertsModule|ProgressEmptyState|progress/);
    const tag = fs.readFileSync(
      path.join(__dirname, '../../patient-app/app/capture/tag.tsx'),
      'utf8',
    );
    expect(tag).toMatch(/capture-tag-\$\{t\}/);
    expect(tag).toMatch(/'skin', 'bill', 'prescription'/);
  });

  test('live: skin-only journey (cold → welcome → capture → tag skin → confirm/reveal skin → auth gate → progress)', async ({
    page,
  }) => {
    test.skip(!BASE, 'Set BASE_URL to run live browser journey');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await settle(page, 2500);
    expect(page.url()).not.toMatch(/face-age|skin-age|try-verdict/);
    // Cold start should land Welcome (medical-tracker IA), not try-verdict.
    if (page.url().match(/\/welcome/)) {
      await expect(page.getByTestId('screen-welcome')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('welcome-get-started').click();
      await settle(page, 1200);
      await expect(page.getByTestId('capture-1-consent')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('capture-consent-continue').click();
      await settle(page, 1200);
      await expect(page.getByTestId('capture-2a')).toBeVisible({ timeout: 20000 });
    } else {
      await page.goto(appUrl('/capture'), { waitUntil: 'domcontentloaded' });
      await settle(page, 1500);
      await assertNotUnmatched(page, 'skin capture');
      await expect(page.getByTestId('capture-2a')).toBeVisible({ timeout: 20000 });
    }
    await page.goto(appUrl('/capture/tag'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'skin tag');
    await expect(page.getByTestId('capture-tag-skin')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('capture-tag-skin').click();
    await expect(page.getByTestId('capture-tag-continue')).toBeVisible();

    await page.goto(appUrl('/capture/confirm/skin'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'skin confirm');
    await expect(page.getByTestId('confirm-5-skin')).toBeVisible({ timeout: 15000 });

    await page.goto(appUrl('/capture/reveal/skin'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'skin reveal');
    await expect(page.getByTestId('reveal-5b-skin')).toBeVisible({ timeout: 15000 });

    await page.goto(appUrl('/sign-in'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1000);
    await expect(page.getByText(/email|code|Sign/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto(appUrl('/progress'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    // Progress may auth-gate to sign-in on cold web — both are valid journey endpoints
    const progressBody = await page.locator('body').innerText();
    expect(progressBody).toMatch(/Progress|Alerts|Nothing|Sign in|email|code/i);
  });

  test('live: bill-only journey (capture → tag bill → confirm/reveal bill)', async ({ page }) => {
    test.skip(!BASE, 'Set BASE_URL to run live browser journey');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(appUrl('/capture'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    await assertNotUnmatched(page, 'bill capture');
    await expect(page.getByTestId('capture-2a')).toBeVisible({ timeout: 20000 });

    await page.goto(appUrl('/capture/tag'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'bill tag');
    await expect(page.getByTestId('capture-tag-bill')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('capture-tag-bill').click();

    await page.goto(appUrl('/capture/confirm/bill'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'bill confirm');
    await expect(page.getByTestId('confirm-5-bill')).toBeVisible({ timeout: 15000 });

    await page.goto(appUrl('/capture/reveal/bill'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1200);
    await assertNotUnmatched(page, 'bill reveal');
    await expect(page.getByTestId('reveal-5b-bill')).toBeVisible({ timeout: 15000 });
  });

  test('live: multi-tag skin+Rx journey (both tags + confirm surfaces)', async ({ page }) => {
    test.skip(!BASE, 'Set BASE_URL to run live browser journey');
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(appUrl('/capture/tag'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1500);
    await assertNotUnmatched(page, 'multi tag screen');
    await expect(page.getByTestId('capture-tag-skin')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('capture-tag-prescription')).toBeVisible({ timeout: 15000 });

    // Skin branch of multi-tag orchestration
    await page.getByTestId('capture-tag-skin').click();
    await page.goto(appUrl('/capture/confirm/skin'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1000);
    await assertNotUnmatched(page, 'multi skin confirm');
    await expect(page.getByTestId('confirm-5-skin')).toBeVisible({ timeout: 15000 });

    // Rx branch — never conflated with Buy CTAs on confirm
    await page.goto(appUrl('/capture/confirm/rx'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1000);
    await assertNotUnmatched(page, 'multi rx confirm');
    await expect(page.getByTestId('confirm-5-rx')).toBeVisible({ timeout: 15000 });
    const rxBody = await page.locator('body').innerText();
    expect(rxBody).not.toMatch(/\bBuy\b/);

    await page.goto(appUrl('/capture/reveal/rx'), { waitUntil: 'domcontentloaded' });
    await settle(page, 1000);
    await assertNotUnmatched(page, 'multi rx reveal');
    const revealBody = await page.locator('body').innerText();
    expect(revealBody).not.toMatch(/Unmatched Route/i);
    expect(revealBody).not.toMatch(/\bBuy\b/);
  });
});
