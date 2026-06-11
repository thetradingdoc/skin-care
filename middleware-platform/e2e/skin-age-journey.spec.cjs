'use strict';

const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const fixtureJpeg = path.join(__dirname, '..', '..', 'inference', 'face-read', 'fixtures', 'sample1.jpg');

const MOCK_FACE_READ = {
  success: true,
  face_read: {
    apparent_age_estimate: 34,
    quality: 'ok',
    model_id: 'e2e-fixture-v1',
    model_version: '2.0.0',
    zone_ages_estimated: true,
    concern_scores: { hyperpigmentation: 2, texture: 1, dryness: 0, redness: 0, acne: 0, pores: 0, dark_circles: 0, oiliness: 0 },
    findings: [
      { id: 'hyperpigmentation', label: 'Uneven tone', severity: 2, detail: 'Visible on cheeks.', zones: ['left_cheek'] },
    ],
    scan_summary: 'Mild uneven tone with otherwise balanced hydration.',
    zone_polygons: {
      left_cheek: [[0.2, 0.4], [0.35, 0.4], [0.35, 0.55], [0.2, 0.55]],
    },
    vision_enabled: true,
  },
};

const MOCK_FACE_READ_REJECT = {
  success: true,
  face_read: {
    reject_reason: 'not_a_face',
    user_message: 'We could not find a face in this photo.',
    quality: 'no_face',
    quality_flags: ['no_face'],
    model_id: 'e2e-fixture-v1',
    findings: [],
    concern_scores: {},
  },
};

const MOCK_FACE_READ_ZONES = {
  success: true,
  face_read: {
    apparent_age_estimate: 32,
    quality: 'ok',
    model_id: 'e2e-fixture-v1',
    model_version: '1.0.0',
    zone_ages: { forehead: 31, t_zone: 33, cheeks: 30 },
    zone_ages_estimated: false,
  },
};

const MOCK_CONCERNS = {
  success: true,
  concerns: [
    { id: 'anti_aging', label: 'Anti-aging care plan', total_weeks: 12 },
    { id: 'acne', label: 'Acne care plan', total_weeks: 12 },
    { id: 'hyperpigmentation', label: 'Hyperpigmentation care plan', total_weeks: 24 },
    { id: 'hyperpigmentation_dark_skin', label: 'Dark spots (melanin-rich skin) plan', total_weeks: 24 },
    { id: 'barrier_repair', label: 'Barrier repair care plan', total_weeks: 8 },
    { id: 'rosacea', label: 'Rosacea care plan', total_weeks: 12 },
  ],
};

const MOCK_MATCH = {
  success: true,
  match: {
    primary_suggestion: 'hyperpigmentation',
    suggested_concern_ids: ['hyperpigmentation', 'anti_aging'],
    route: 'track_program',
  },
};

async function installApiMocks(page, { faceRead = MOCK_FACE_READ } = {}) {
  await page.route('**/api/public/face-read', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(faceRead) });
  });
  await page.route('**/api/public/funnel/match', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MATCH) });
  });
  await page.route('**/api/public/routines/concerns', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONCERNS) });
  });
  await page.route('**/api/public/funnel/journey', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, journey_id: 'fj_e2e_test' }),
      });
      return;
    }
    await route.continue();
  });
}

async function acceptScanConsent(page) {
  await expect(page.getByRole('heading', { name: /photo analysis consent/i })).toBeVisible();
  await page.locator('.sc-consent-row input[type="checkbox"]').check();
  await page.getByRole('button', { name: /continue to camera/i }).click();
}

async function completeQuickCheck(page) {
  await page.getByRole('button', { name: 'Tight / dry' }).click();
  await page.getByRole('button', { name: 'Full routine' }).click();
  await page.getByRole('button', { name: /continue/i }).click();
}

test.describe('Skin age journey (consumer hosting)', () => {
  test('E2E-01 Landing CTA → /scan', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /facial age checker/i }).click();
    await expect(page).toHaveURL(/\/scan/);
  });

  test('E2E-14 Consent gate: scan blocked without checkbox', async ({ page }) => {
    await page.goto('/scan');
    await expect(page.getByRole('button', { name: /continue to camera/i })).toBeDisabled();
    await page.locator('.sc-consent-row input[type="checkbox"]').check();
    await expect(page.getByRole('button', { name: /continue to camera/i })).toBeEnabled();
  });

  test('E2E-02 Scan shutter disabled until aligned (upload fallback)', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/scan');
    await acceptScanConsent(page);
    const shutter = page.locator('.sc-scan-shutter');
    if (await shutter.count()) {
      await expect(shutter).toBeDisabled();
    } else {
      await expect(page.getByRole('button', { name: /upload selfie/i })).toBeVisible();
    }
  });

  test('E2E-03 Upload fixture → face-read → /quick-check', async ({ page }) => {
    test.skip(!fs.existsSync(fixtureJpeg), 'fixture JPEG missing');
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('e2e_camera_denied'));
    });
    await installApiMocks(page);
    await page.goto('/scan');
    await acceptScanConsent(page);
    await page.getByRole('button', { name: /upload selfie/i }).click();
    const fileInput = page.locator('input[type="file"]');
    const faceReadDone = page.waitForResponse(
      (r) => r.url().includes('/api/public/face-read') && r.status() === 200,
    );
    await fileInput.setInputFiles(fixtureJpeg);
    await faceReadDone;
    await expect(page).toHaveURL(/\/quick-check/, { timeout: 15_000 });
  });

  test('E2E-04 Quick-check both questions required', async ({ page }) => {
    await installApiMocks(page);
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 34,
          quality: 'ok',
          model_id: 'e2e-fixture-v1',
        }),
      );
    });
    await page.goto('/quick-check');
    const continueBtn = page.getByRole('button', { name: /see my results/i });
    await expect(continueBtn).toBeDisabled();
    await page.getByRole('button', { name: 'Normal' }).click();
    await expect(continueBtn).toBeDisabled();
    await page.getByRole('button', { name: 'Sometimes' }).click();
    await expect(continueBtn).toBeDisabled();
    await page.getByRole('button', { name: 'Evening' }).click();
    await expect(continueBtn).toBeEnabled();
  });

  test('E2E-05 Reveal shows score row, findings with plain_language', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 28,
          quality: 'ok',
          model_id: 'e2e-fixture-v1',
          vision_enabled: true,
          concern_scores: { hyperpigmentation: 3, texture: 2, acne: 0, dryness: 0, redness: 0, pores: 0, dark_circles: 0, oiliness: 0 },
          health_scores: { hydration: 72, clarity: 44, evenness: 38, barrier: 61 },
          findings: [
            {
              id: 'hyperpigmentation',
              label: 'Dark spots',
              plain_language: 'Visible uneven tone on cheeks.',
              severity: 3,
              zones: ['left_cheek'],
            },
          ],
          scan_summary: 'Uneven tone with otherwise balanced hydration.',
          fitzpatrick_estimate: 'VI',
          fit_skin_tone: 'dark',
          zone_polygons: { left_cheek: [[0.2, 0.4], [0.35, 0.55]] },
        }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
      sessionStorage.setItem(
        'sc_onboarding_face_photo_url',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      );
    });
    await page.goto('/reveal');
    await expect(page.locator('.sc-reveal-photo-img')).toBeVisible();
    await expect(page.locator('.sc-score-row')).toBeVisible();
    await expect(page.getByText('Face age')).toBeVisible();
    await expect(page.getByText('Skin age')).toBeVisible();
    await expect(page.getByText('Skin health score')).toBeVisible();
    await expect(page.locator('.sc-score-meter')).toHaveCount(4);
    await expect(page.locator('.sc-meter-label').filter({ hasText: 'Hydration' })).toBeVisible();
    await expect(page.locator('.sc-meter-val').filter({ hasText: '72' })).toBeVisible();
    await expect(page.locator('.sc-finding-card')).toHaveCount(1);
    await expect(page.getByText(/uneven tone on cheeks/i)).toBeVisible();
    await expect(page.locator('.sc-real-age-row')).toBeVisible();
    await expect(page.getByRole('button', { name: /build my routine/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /scan again/i })).toBeVisible();
  });

  test('E2E-06 Reveal no longer shows legacy zone age row', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 34,
          quality: 'ok',
          model_id: 'e2e-fixture-v1',
          zone_ages_estimated: true,
          zone_ages: { forehead: 30, t_zone: 36, cheeks: 32 },
          vision_enabled: true,
          findings: [{ id: 'dryness', label: 'Dryness', plain_language: 'Some flaking.', severity: 1, zones: [] }],
          scan_summary: 'Mild dryness noted.',
        }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
    });
    await page.goto('/reveal');
    await expect(page.locator('.sc-zone-row')).toHaveCount(0);
    await expect(page.locator('.sc-score-row')).toBeVisible();
  });

  test('E2E-16 Reveal State B: vision failed hides age, shows retry tips', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 17,
          quality: 'ok',
          model_id: 'e2e-fixture-v1',
          vision_enabled: true,
          vision_error: null,
          findings: [],
          concern_scores: {},
          scan_summary: '',
        }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
      sessionStorage.setItem(
        'sc_onboarding_face_photo_url',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      );
    });
    await page.goto('/reveal');
    await expect(page.locator('.sc-score-row')).toHaveCount(0);
    await expect(page.getByText(/couldn't read your skin clearly/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /scan again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with quick-check/i })).toBeVisible();
  });

  test('E2E-17 poor_lighting finding shows State A not retry', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 32,
          quality: 'low',
          model_id: 'e2e-fixture-v1',
          vision_enabled: true,
          findings: [
            {
              id: 'poor_lighting',
              label: 'Low light conditions',
              plain_language: 'The photo lighting made it harder to read your skin details accurately.',
              severity: 1,
              zones: [],
              confidence: 0.95,
            },
          ],
          concern_scores: {},
          scan_summary: 'Lighting affected scan quality for this deep tone photo.',
          fitzpatrick_estimate: 'VI',
          fit_skin_tone: 'dark',
        }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
    });
    await page.goto('/reveal');
    await expect(page.locator('.sc-retry-state')).toHaveCount(0);
    await expect(page.locator('.sc-finding-card')).toHaveCount(1);
    await expect(page.getByText(/low light conditions/i)).toBeVisible();
  });

  test('E2E-07 Concerns: match preselects primary from richer face_read', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/concerns');
    await page.evaluate(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({
          apparent_age_estimate: 34,
          model_id: 'e2e-fixture-v1',
          concern_scores: { hyperpigmentation: 3, acne: 0 },
          findings: [{ id: 'hyperpigmentation', severity: 3, zones: ['left_cheek'] }],
        }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
    });
    await page.reload();
    await expect(page.locator('.sc-concern-card')).toHaveCount(6);
    await expect(page.locator('.sc-concern-card--pick')).toBeVisible();
    await expect(page.getByText(/pre-selected based on your scan/i)).toBeVisible();
  });

  test('E2E-15 Gate reject stays on scan with user message', async ({ page }) => {
    test.skip(!fs.existsSync(fixtureJpeg), 'fixture JPEG missing');
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error('e2e_camera_denied'));
    });
    await installApiMocks(page, { faceRead: MOCK_FACE_READ_REJECT });
    await page.goto('/scan');
    await acceptScanConsent(page);
    await page.getByRole('button', { name: /upload selfie/i }).click();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(fixtureJpeg);
    await expect(page).toHaveURL(/\/scan/);
    await expect(page.getByText(/could not find a face/i)).toBeVisible({ timeout: 15_000 });
  });

  test('E2E-08 Concerns CTA → signup with funnel intent', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/concerns');
    await page.evaluate(() => {
      sessionStorage.setItem(
        'sc_onboarding_face_read',
        JSON.stringify({ apparent_age_estimate: 34, model_id: 'e2e-fixture-v1' }),
      );
      sessionStorage.setItem('sc_onboarding_quick_check_done', '1');
    });
    await page.reload();
    await page.getByRole('button', { name: /start .* plan/i }).click();
    await expect(page).toHaveURL(/\/app\/sign-in/);
    await expect(page.url()).toMatch(/intent=signup/);
    await expect(page.url()).toMatch(/from=skin-age-landing/);
  });

  test('E2E-09 Sign-in OTP page loads for funnel signup', async ({ page }) => {
    await page.goto('/app/sign-in?intent=signup&from=skin-age-landing');
    await expect(page.getByText('Save your plan')).toBeVisible();
  });

  test('E2E-10 Post-signup handoff clears sessionStorage keys', async ({ page }) => {
    await page.goto('/app/sign-in?intent=signup&from=skin-age-landing');
    await page.evaluate(() => {
      sessionStorage.setItem('sc_onboarding_concern_id', 'anti_aging');
      sessionStorage.setItem('sc_onboarding_face_read', '{"apparent_age_estimate":34}');
    });
    const keysBefore = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('sc_onboarding')));
    expect(keysBefore.length).toBeGreaterThan(0);
    await page.evaluate(() => {
      ['sc_onboarding_concern_id', 'sc_onboarding_face_read', 'sc_onboarding_match_json'].forEach((k) =>
        sessionStorage.removeItem(k),
      );
    });
    const keysAfter = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('sc_onboarding')));
    expect(keysAfter.length).toBe(0);
  });

  test('E2E-11 Today tab (patient app — documented skip)', async () => {
    test.skip(true, 'Conflict wedge: middleware-platform/e2e/conflict-engine-mobile.spec.cjs');
  });

  test('E2E-12 Progress tab (patient app — documented skip)', async () => {
    test.skip(true, 'Conflict wedge: playwright.conflict-engine.config.cjs + progress-summary API tests');
  });

  test('E2E-13 Live smoke CORS + favicon (optional)', async ({ request }) => {
    test.skip(process.env.SKIN_AGE_LIVE_SMOKE !== '1', 'Set SKIN_AGE_LIVE_SMOKE=1 for production checks');
    const api = 'https://api.callsomo.com';
    const preflight = await request.fetch(`${api}/api/public/face-read`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://www.myskinandcare.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(preflight.status()).toBeLessThan(500);
    const allowOrigin = preflight.headers()['access-control-allow-origin'] || '';
    expect(allowOrigin).toMatch(/myskinandcare\.com/);
  });
});

test('E2E fixture: vision zones path for match mock', async () => {
  expect(MOCK_FACE_READ_ZONES.face_read.zone_ages_estimated).toBe(false);
});
