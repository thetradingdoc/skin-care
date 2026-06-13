'use strict';

const { test, expect } = require('@playwright/test');
const {
  seedDiaryJourney,
  stubJournalApis,
  stubJournalApisWithStreak,
  assertTypography,
  assertComputedColor,
  captureScreenAudit,
  createInventory,
  recordFunctional,
  recordParity,
  writeInventory,
} = require('./helpers/journal-ui-audit-helpers.cjs');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

const inventory = createInventory();

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ context }) => {
  await seedDiaryJourney(context, API_BASE);
});

test.afterAll(async () => {
  writeInventory(inventory);
});

test.describe('Journal-first functional flows', () => {
  test('onboarding shows 3 journey cards and diary routes to Home', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('What brings you here?')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Keep a skin diary')).toBeVisible();
    await expect(page.getByText('Improve my skin routine')).toBeVisible();
    await expect(page.getByText('Watch a spot or mark')).toBeVisible();
    await captureScreenAudit(page, 'onboarding-journey-choose', inventory);

    const continueBtn = page.getByRole('button', { name: 'Continue' });
    await continueBtn.click();
    await expect(page).toHaveURL(/\/home/, { timeout: 20_000 });
    recordFunctional(inventory, 'onboarding_three_cards', true, '3 cards visible; Continue → Home');
  });

  test('diary Home shows journal CTA without routine gate', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await expect(page.getByText(/Log today.s photo/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Choose your routine')).toHaveCount(0);
    await expect(page.getByText('How does your skin feel today?')).toBeVisible();
    await captureScreenAudit(page, 'home-diary', inventory);
    recordFunctional(inventory, 'diary_home_journal_cta', true, 'Journal CTA + chips; no routine gate');
  });

  test('diary Home shows trigger insight when stubbed', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await expect(page.getByText(/trigger insight/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Dairy may trigger breakouts/i)).toBeVisible();
    recordFunctional(inventory, 'diary_home_trigger_insight', true, 'Trigger insight card renders');
  });

  test('journal capture route loads', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/journal/capture', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/Camera access|Enable camera|Log photo|Save to journal/i).first(),
    ).toBeVisible({
      timeout: 30_000,
    });
    await captureScreenAudit(page, 'journal-capture', inventory);
    recordFunctional(inventory, 'journal_capture_loads', true, 'Capture screen renders');
  });

  test('tab bar navigates all 5 tabs', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    for (const tab of ['Home', 'Track', 'Scan', 'Progress', 'Profile']) {
      await page.getByRole('tab', { name: tab }).click();
      await expect(page.getByRole('tab', { name: tab })).toBeVisible({ timeout: 15_000 });
    }
    recordFunctional(inventory, 'tab_bar_navigation', true, 'All 5 tabs clickable');
  });

  test('progress screen shows title and improvements when stubbed', async ({ page }) => {
    await stubJournalApisWithStreak(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await expect(page.getByText('Your progress')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Skin improvements')).toBeVisible();
    await captureScreenAudit(page, 'progress-stubbed', inventory);
    recordFunctional(inventory, 'progress_loads', true, 'Progress title + improvements section');
  });

  test('account shows Watch a spot journey toggle', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/account', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText('Watch a spot or mark').first()).toBeVisible({ timeout: 30_000 });
    await captureScreenAudit(page, 'account-journey', inventory);
    recordFunctional(inventory, 'account_spot_toggle', true, 'Spot journey toggle visible');
  });
});

test.describe('Design parity checks (inventory only)', () => {
  test('onboarding Continue uses #111 CTA', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
    const btn = page.getByRole('button', { name: 'Continue' });
    await expect(btn).toBeVisible({ timeout: 30_000 });
    const result = await assertComputedColor(page, btn, 'backgroundColor', '#111111');
    recordParity(
      inventory,
      'cta_continue_black',
      result.pass,
      result.pass ? 'Continue CTA #111' : `Expected #111, got ${result.actual}`,
      'medium',
    );
    expect(result.pass).toBe(true);
  });

  test('journey title uses display serif typography', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/onboarding/journey-choose', { waitUntil: 'domcontentloaded' });
    const title = page.getByText('What brings you here?');
    await expect(title).toBeVisible({ timeout: 30_000 });
    const result = await assertTypography(page, title, { fontSizeMin: 24, serif: true });
    recordParity(
      inventory,
      'onboarding_title_serif',
      result.pass,
      result.pass ? 'Serif display title' : result.issues.join('; '),
      'high',
    );
    expect(result.pass).toBe(true);
  });

  test('progress title uses large display typography', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    const title = page.getByText('Your progress', { exact: true });
    await expect(title).toBeVisible({ timeout: 30_000 });
    const result = await assertTypography(page, title, { fontSizeMin: 24, serif: true });
    recordParity(
      inventory,
      'progress_title_display',
      result.pass,
      result.pass ? 'Progress title ≥24px serif' : result.issues.join('; '),
      'high',
    );
    expect(result.pass).toBe(true);
  });

  test('progress subtitle present', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    await expect(page.getByText('Your progress', { exact: true })).toBeVisible({ timeout: 15_000 });
    const subtitle = page.getByText('Small changes. Real results.');
    const visible = await subtitle.isVisible().catch(() => false);
    recordParity(
      inventory,
      'progress_subtitle',
      visible,
      visible ? 'Subtitle present' : 'Missing "Small changes. Real results."',
      'medium',
    );
    expect(visible).toBe(true);
  });

  test('progress empty streak shows polaroid hero card', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    const hero = page.getByText('Start your photo streak');
    await expect(hero).toBeVisible({ timeout: 30_000 });
    recordParity(
      inventory,
      'progress_polaroid_hero',
      true,
      'Polaroid streak hero present',
      'high',
    );
  });

  test('progress has calendar header button', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    const cal = page.getByRole('button', { name: /open calendar/i });
    await expect(cal).toBeVisible({ timeout: 30_000 });
    recordParity(
      inventory,
      'progress_calendar_button',
      true,
      'Calendar button in header',
      'medium',
    );
  });

  test('progress has sparkline metric cards', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    const redness = page.getByText('Redness').first();
    await expect(redness).toBeVisible({ timeout: 15_000 });
    const hasSparkline = await page.locator('[data-testid="metric-sparkline"]').count();
    const pass = hasSparkline >= 4;
    recordParity(
      inventory,
      'progress_sparkline_metrics',
      pass,
      pass ? '4 sparkline metric cards' : `Found ${hasSparkline} sparkline cards, expected 4`,
      'high',
    );
    expect(pass).toBe(true);
  });

  test('progress timeline has See all link', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Your progress', { exact: true })).toBeVisible({ timeout: 30_000 });
    const seeAll = page.getByText('See all');
    await expect(seeAll).toBeVisible({ timeout: 15_000 });
    recordParity(
      inventory,
      'progress_timeline_see_all',
      true,
      'See all link on timeline',
      'medium',
    );
  });

  test('tab bar has 5 labels with brand blue active state', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/progress', { waitUntil: 'domcontentloaded' });
    for (const label of ['Home', 'Track', 'Scan', 'Progress', 'Profile']) {
      await expect(page.getByRole('tab', { name: label })).toBeVisible({ timeout: 15_000 });
    }
    const progressLabel = page.getByRole('tab', { name: 'Progress' }).getByText('Progress', { exact: true });
    const homeLabel = page.getByRole('tab', { name: 'Home' }).getByText('Home', { exact: true });
    const progressColor = await progressLabel.evaluate((el) => getComputedStyle(el).color);
    const homeColor = await homeLabel.evaluate((el) => getComputedStyle(el).color);
    const pass = progressColor !== homeColor && /49,\s*77,\s*182/.test(progressColor);
    recordParity(
      inventory,
      'tab_bar_active_color',
      pass,
      pass ? 'Active tab uses brand blue' : `Progress: ${progressColor}, Home: ${homeColor}`,
      'low',
    );
    expect(pass).toBe(true);
  });

  test('diary home has recent photo strip', async ({ page }) => {
    await stubJournalApis(page);
    await page.goto('/app/(tabs)/home', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Log today.s photo/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Recent photos')).toBeVisible({ timeout: 15_000 });
    recordParity(
      inventory,
      'home_recent_photo_strip',
      true,
      'Recent photo strip on Home',
      'medium',
    );
  });
});
