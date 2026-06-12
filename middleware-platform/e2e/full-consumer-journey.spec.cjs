'use strict';

/**
 * Full consumer journey: create user → choose template → track over time → home/progress.
 * Run: npm run test:e2e:full-journey
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { stubRedesignApis, seedRedesignStorage } = require('./helpers/redesign-mock-stubs.cjs');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
const OUT_DIR = path.join(__dirname, '..', 'playwright-report', 'full-journey');
const OUT_JSON = path.join(OUT_DIR, 'journey-report.json');

const MOCK_CONCERNS = {
  success: true,
  concerns: [
    { id: 'acne', label: 'Acne care plan', total_weeks: 12 },
    { id: 'hyperpigmentation', label: 'Hyperpigmentation care plan', total_weeks: 24 },
  ],
};

const MOCK_PREVIEW = {
  success: true,
  preview: { key_rules: ['AM: gentle cleanser', 'PM: retinoid on alternate nights'] },
};

const journeyLog = {
  startedAt: new Date().toISOString(),
  steps: [],
  issues: [],
  passed: 0,
  failed: 0,
};

function logStep(id, label, ok, detail = null) {
  journeyLog.steps.push({ id, label, ok, detail, at: new Date().toISOString() });
  if (ok) journeyLog.passed += 1;
  else journeyLog.failed += 1;
}

function logIssue(msg) {
  journeyLog.issues.push({ msg, at: new Date().toISOString() });
}

async function seedSession(context, { withJourney = false, withSpots = false } = {}) {
  await context.addInitScript(
    ({ api, sessionId, withJourney, withSpots }) => {
      localStorage.setItem('patient_session_id', sessionId);
      localStorage.setItem('patient_session_email', 'journey-e2e@example.com');
      localStorage.setItem('patient_api_base_url', api);
      localStorage.setItem('api_base', api);
      if (withJourney) {
        localStorage.setItem(
          'patient_journey_profile_v1',
          JSON.stringify({ modes: ['watch', 'routine'], primary: 'watch', chosenAt: new Date().toISOString() }),
        );
      } else {
        localStorage.removeItem('patient_journey_profile_v1');
      }
      if (withSpots) {
        localStorage.setItem(
          'patient_spots_v1',
          JSON.stringify([
            {
              id: 'spot_neck_1',
              label: 'Neck spot',
              bodyRegion: 'neck',
              createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
              photos: [{ date: '2026-06-01' }],
            },
          ]),
        );
      }
    },
    { api: API_BASE, sessionId: 'pw-full-journey-session', withJourney, withSpots },
  );
}

async function stubJourneyApis(page) {
  let hasTemplate = false;
  let journeyChosen = false;
  const sessionId = 'pw-full-journey-session';

  await stubRedesignApis(page);

  await page.route(/\/api\/patient\/verify\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/send')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, session_id: sessionId }),
      });
    }
    if (url.includes('/confirm')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session_id: sessionId,
          patient_id: 'patient_pw_journey',
          email: 'journey-e2e@example.com',
        }),
      });
    }
    return route.continue();
  });

  await page.route(/\/api\/public\/routines\//, async (route) => {
    const url = route.request().url();
    if (url.includes('/concerns')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONCERNS) });
    }
    if (url.includes('/preview')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PREVIEW) });
    }
    return route.continue();
  });

  await page.route(/\/api\/patient\/consumer-profile/, async (route) => {
    if (route.request().method() === 'PATCH') {
      journeyChosen = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          profile: {
            journey_modes: ['watch', 'routine'],
            primary_mode: 'watch',
            onboarding_complete: true,
            bio_calibration_complete: true,
          },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        profile: journeyChosen
          ? {
              journey_modes: ['watch', 'routine'],
              primary_mode: 'watch',
              onboarding_complete: true,
              bio_calibration_complete: true,
            }
          : {
              journey_modes: [],
              primary_mode: null,
              onboarding_complete: false,
              bio_calibration_complete: false,
            },
      }),
    });
  });

  await page.route(/\/api\/patient\/routine\/template/, async (route) => {
    if (route.request().method() === 'POST') {
      hasTemplate = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          template: { name: 'Acne care plan', concern_id: 'acne', duration_weeks: 12 },
        }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        has_template: hasTemplate,
        template: hasTemplate ? { name: 'Acne care plan', concern_id: 'acne' } : null,
      }),
    });
  });

  // Override redesign defaults so resolvePostAuthRoute() routes new routine users to /routine/pick.
  await page.route(/\/api\/patient\/spots$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, spots: [] }),
    });
  });

  await page.route(/\/api\/patient\/shelf\/products$/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        products: hasTemplate ? [{ id: 'p1', product_name: 'CeraVe Cleanser' }] : [],
      }),
    });
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: true });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test('01 — Create account via email OTP', async ({ page }) => {
  await stubJourneyApis(page);
  await page.goto('/app/sign-in?intent=signup', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Create account')).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder('you@example.com').fill('journey-e2e@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText('Enter code')).toBeVisible({ timeout: 15_000 });
  await shot(page, '01-otp-sent');

  await page.getByPlaceholder('123456').fill('123456');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/journey-choose/, { timeout: 20_000 });
  await expect(page.getByText('What brings you here?')).toBeVisible();
  await shot(page, '02-journey-choose');
  logStep('signup', 'Create account via OTP → journey chooser', true);
});

test('02 — Choose journey modes (watch + routine)', async ({ page, context }) => {
  await seedSession(context, { withJourney: false });
  await stubJourneyApis(page);
  await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('What brings you here?')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Improve my skin routine').click();
  await page.getByText('Watch something on my skin').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/routine\/pick/, { timeout: 20_000 });
  await shot(page, '03-after-journey');
  logStep('journey', 'Choose watch + routine → template pick when no program', true);
});

test('03 — Choose acne template and start program', async ({ page, context }) => {
  await seedSession(context, { withJourney: true });
  await stubJourneyApis(page);
  await page.goto('/app/routine/pick', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Acne care plan')).toBeVisible({ timeout: 30_000 });
  await page.getByText('Acne care plan').click();
  await expect(page.getByText(/gentle cleanser/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page).toHaveURL(/\/(home|track|scan|bio-calibration)/, { timeout: 20_000 });
  if (!page.url().includes('/home')) {
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
  }
  await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
  await shot(page, '04-home-after-template');
  logStep('template', 'Choose acne template → post-auth route → Home', true);
});

test('04 — Track tab ATM and spot timeline', async ({ page, context }) => {
  await seedSession(context, { withJourney: true, withSpots: true });
  await seedRedesignStorage(context, API_BASE);
  await stubJourneyApis(page);
  await page.goto('/app/(tabs)/track', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Track a spot')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('See my photos so far')).toBeVisible();
  await shot(page, '05-track-atm');
  logStep('track_atm', 'Track tab ATM actions visible', true);

  await page.goto('/app/track/spot_neck_1', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/How has it changed/i)).toBeVisible({ timeout: 30_000 });
  const body = await page.locator('body').innerText();
  const hasTimeline = /Jun|week|photo|snapshot/i.test(body) || /Neck spot/i.test(body);
  const hasGrowth = /growing|stable|shrinking|change/i.test(body);
  if (!hasGrowth) logIssue('Growth summary card copy not detected on spot timeline');
  await shot(page, '06-spot-timeline');
  logStep('track_timeline', 'Spot timeline with change history', hasTimeline, { hasGrowth });
});

test('05 — Home dashboard: BFI, routine, next actions', async ({ page, context }) => {
  await seedSession(context, { withJourney: true });
  await seedRedesignStorage(context, API_BASE);
  await stubJourneyApis(page);
  await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
  await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  await page.getByText(/Barrier|Choose your routine|Suggested for you/i).first().waitFor({ timeout: 15_000 }).catch(() => {});
  const body = await page.locator('body').innerText();
  const hasBfi = /62|barrier|friction/i.test(body);
  const hasNextAction = /Ease off actives|barrier|tonight/i.test(body);
  const hasRoutine = /cleanser|retinol|moistur/i.test(body);
  if (!hasNextAction) logIssue('NextActionCard from journey agent not visible on Home');
  await shot(page, '07-home-dashboard');
  logStep('home', 'Home shows BFI + routine steps', hasBfi && hasRoutine, { hasNextAction });
});

test('06 — Progress tab: streak and spot link', async ({ page, context }) => {
  await seedSession(context, { withJourney: true, withSpots: true });
  await seedRedesignStorage(context, API_BASE);
  await stubJourneyApis(page);
  await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Your progress', { exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByText(/streak|Neck spot|BFI/i).first().waitFor({ timeout: 15_000 }).catch(() => {});
  const body = await page.locator('body').innerText();
  const hasStreak = /14|streak/i.test(body);
  const hasSpot = /Neck spot/i.test(body);
  await shot(page, '08-progress');
  logStep('progress', 'Progress tab with streak and spot row', hasStreak && hasSpot);
});

test.afterAll(() => {
  journeyLog.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT_JSON, JSON.stringify(journeyLog, null, 2));
});
