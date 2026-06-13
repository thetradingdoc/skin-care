'use strict';

const { test, expect } = require('@playwright/test');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

const JOURNEY_KEY = 'patient_journey_profile_v1';
const SPOTS_KEY = 'patient_spots_v1';

async function stubPatientApis(page) {
  await page.route(/\/api\/patient\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/routine/template')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, has_template: true, template: { name: 'Acne program' } }),
      });
    }
    if (url.includes('/shelf/products') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          products: [{ id: 'p1', product_name: 'Retinol', usage_time: 'pm' }],
        }),
      });
    }
    if (url.includes('/routine/evaluate')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          overall: 'caution',
          barrier_friction_index: 62,
          hero_title: 'Barrier under stress',
          conflicts: [{ notes: 'test' }],
          product_statuses: [],
        }),
      });
    }
    if (url.includes('/bio-profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          profile: { profile_complete: true, conditions: ['acne'], prescriptions: [] },
        }),
      });
    }
    if (url.includes('/home/progress-summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, summary: { streak_days: 0 }, improvement_metrics: {} }),
      });
    }
    if (url.includes('/consumer-profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          profile: {
            journey_modes: [],
            primary_mode: null,
            onboarding_complete: false,
            bio_calibration_complete: false,
          },
        }),
      });
    }
    if (url.includes('/journal/calendar-range')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, days: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe('Patient app v3 redesign', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(
      ({ api, journeyKey, spotsKey }) => {
        localStorage.setItem('patient_session_id', 'ps_e2e_v3');
        localStorage.setItem('patient_api_base_url', api);
        localStorage.setItem('api_base', api);
        localStorage.setItem(
          journeyKey,
          JSON.stringify({
            modes: ['watch', 'routine'],
            primary: 'routine',
            chosenAt: new Date().toISOString(),
          }),
        );
        localStorage.setItem(
          spotsKey,
          JSON.stringify([
            {
              id: 'spot_test_1',
              label: 'Neck spot',
              bodyRegion: 'neck',
              createdAt: new Date().toISOString(),
              photos: [{ date: '2026-06-01' }],
            },
          ]),
        );
      },
      { api: API_BASE, journeyKey: JOURNEY_KEY, spotsKey: SPOTS_KEY },
    );
  });

  test('tab bar shows Home Track Scan Progress Profile without _journal', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: 'Track' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Scan' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Progress' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
    await expect(page.getByText('_journal')).toHaveCount(0);
  });

  test('track tab shows ATM actions', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/(tabs)/track', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Track a spot')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Take a photo now')).toBeVisible();
    await expect(page.getByText('Upload from gallery')).toBeVisible();
    await expect(page.getByText('See my photos so far')).toBeVisible();
  });

  test('journey chooser renders mode cards', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('skin care')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('What brings you here?')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Keep a skin diary')).toBeVisible();
    await expect(page.getByText('Improve my skin routine')).toBeVisible();
    await expect(page.getByText('Watch a spot or mark')).toBeVisible();
  });

  test('journey chooser Continue uses black consumer CTA', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
    const btn = page.getByRole('button', { name: 'Continue' });
    await expect(btn).toBeVisible({ timeout: 30_000 });
    const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(17, 17, 17)');
  });

  test('legacy timeline redirects to progress', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/timeline', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/progress/, { timeout: 30_000 });
    await expect(page.getByText('Your progress', { exact: true })).toBeVisible();
  });

  test('progress shows spot tracking section', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Spot tracking')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Neck spot')).toBeVisible();
  });

  test('no raw SQL errors on home', async ({ page }) => {
    await stubPatientApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/no such table/i)).toHaveCount(0);
  });
});
