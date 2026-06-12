'use strict';

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  MOCK_PRODUCT_ID,
  MOCK_VERDICT_PRODUCT_ID,
  seedRedesignStorage,
  stubRedesignApis,
} = require('./helpers/redesign-mock-stubs.cjs');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');
const OUT_JSON = path.join(__dirname, '..', 'playwright-report', 'redesign-live-inventory.json');
const OUT_SCREENSHOTS = path.join(__dirname, '..', 'playwright-report', 'redesign-audit-screenshots', 'live');

const SCREENS = [
  {
    id: 'journey-choose',
    label: 'Step 1 — choose your journey',
    route: '/app/onboarding/journey-choose',
    mockupRoute: '/app/onboarding/journey-choose',
    readyText: /What brings you here/i,
    functions: ['Select watch vs routine journey mode', 'Dual-mode note'],
    buttons: [
      { name: 'Watch something on my skin', action: 'toggle_watch', role: 'button' },
      { name: 'Improve my skin routine', action: 'toggle_routine', role: 'button' },
      { name: 'Continue', action: 'navigate_after_choose', role: 'button', expectUrl: /\/(home|track)/ },
    ],
  },
  {
    id: 'track-atm',
    label: 'Journey A — ATM-simple',
    route: '/app/(tabs)/track',
    mockupRoute: '/app/(tabs)/track',
    readyText: /Track a spot/i,
    functions: ['ATM entry: camera, gallery, timeline'],
    buttons: [
      { name: 'Take a photo now', action: 'open_capture', expectUrl: /\/track\/capture/ },
      { name: 'Upload from gallery', action: 'gallery_capture', skip: true, skipReason: 'Native picker' },
      { name: 'See my photos so far', action: 'open_spot_timeline', expectUrl: /\/track\// },
    ],
  },
  {
    id: 'track-capture',
    label: 'Journey A — photo capture',
    route: '/app/track/capture',
    mockupRoute: '/app/track/capture',
    readyText: /Position your skin/i,
    functions: ['Spot capture with body map'],
    buttons: [
      { name: 'Cancel', action: 'go_back' },
      { name: 'Save photo', action: 'save_photo', expectUrl: /\/track\// },
    ],
  },
  {
    id: 'spot-timeline',
    label: 'Journey A — spot timeline',
    route: '/app/track/spot_neck_1',
    mockupRoute: '/app/track/[spotId]',
    readyText: /How has it changed/i,
    functions: ['Timeline strip', 'Growth card', 'Doctor alert'],
    buttons: [
      { name: /back/i, action: 'go_back', useText: true },
      { name: 'Find a dermatologist', action: 'external_link', skip: true, skipReason: 'Opens external AAD URL' },
      { name: 'Add another photo', action: 'add_photo', expectUrl: /\/track\/capture/ },
    ],
  },
  {
    id: 'home',
    label: 'Today — Whoop-style',
    route: '/app/(tabs)/home',
    mockupRoute: '/app/(tabs)/home',
    readyText: /Good morning|Barrier under stress|Tonight/i,
    functions: ['BFI ring', 'Routine steps', 'Daily photo CTA'],
    buttons: [
      { name: /Take today's photo/i, action: 'routine_capture', expectUrl: /\/routine\/capture/ },
      { name: 'Conflicts', action: 'open_scan', expectUrl: /\/scan/, optional: true },
    ],
  },
  {
    id: 'scan',
    label: 'Scan — barcode + shelf',
    route: '/app/(tabs)/scan',
    mockupRoute: '/app/(tabs)/scan',
    readyText: /Your products|barcode/i,
    functions: ['Barcode scanner', 'Shelf list', 'Add product'],
    buttons: [
      { name: 'Add product', action: 'manual_add', expectText: /add by name/i },
      { name: 'CeraVe Retinol Serum', action: 'open_verdict', useText: true, expectUrl: new RegExp(`/verdict/${MOCK_PRODUCT_ID}`) },
    ],
  },
  {
    id: 'verdict',
    label: 'Verdict — personalized',
    route: `/app/verdict/${MOCK_PRODUCT_ID}`,
    mockupRoute: '/app/verdict/[productId]',
    readyText: /Why flagged|The fix/i,
    functions: ['Verdict hero', 'Conflicts', 'Fix card', 'Remove/keep'],
    buttons: [
      { name: /don't use it|remove from shelf/i, action: 'remove_product', expectUrl: /\/scan/ },
      { name: /keep anyway/i, action: 'keep_product', expectUrl: /\/scan/ },
    ],
  },
  {
    id: 'progress',
    label: 'Progress — both journeys',
    route: '/app/(tabs)/progress',
    mockupRoute: '/app/(tabs)/progress',
    readyText: /Your progress/i,
    functions: ['Streak', 'BFI grid', 'Dip insight', 'Metrics', 'Spot row'],
    buttons: [
      { name: 'Neck spot', action: 'open_spot', useText: true, expectUrl: /\/track\/spot_neck_1/ },
    ],
  },
  {
    id: 'account',
    label: 'Profile — not in mockup',
    route: '/app/(tabs)/account',
    mockupRoute: null,
    readyText: /Profile|Account|Sign out|Your goals/i,
    functions: ['Journey toggles', 'Goals list', 'Subscription', 'Sign out'],
    mockupGap: 'Profile tab screen missing from HTML spec',
    buttons: [
      { name: 'Sign out', action: 'sign_out', useText: true, expectUrl: /\/sign-in/ },
      { name: 'Change program', action: 'routine_pick', useText: true, expectUrl: /\/routine\/pick/, optional: true },
    ],
  },
];

const inventory = {
  auditedAt: new Date().toISOString(),
  source: 'live_patient_app',
  type: 'expo_web_consumer_hosting',
  apiBase: API_BASE,
  screens: [],
  summary: { totalButtons: 0, passed: 0, failed: 0, skipped: 0, notConfigured: 0 },
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.mkdirSync(OUT_SCREENSHOTS, { recursive: true });
});

test.beforeEach(async ({ context }) => {
  await seedRedesignStorage(context, API_BASE);
});

async function clickNamed(page, btn) {
  if (btn.useText) {
    await page.getByText(btn.name).first().click({ timeout: 10_000 });
    return;
  }
  await page.getByRole(btn.role || 'button', { name: btn.name }).first().click({ timeout: 10_000 });
}

for (const screen of SCREENS) {
  test(`screen: ${screen.id}`, async ({ page }) => {
    await stubRedesignApis(page);
    await page.goto(screen.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    const ready = page.getByText(screen.readyText);
    await expect(ready.first()).toBeAttached({ timeout: 45_000 });
    await ready.first().scrollIntoViewIfNeeded().catch(() => {});
    await expect(ready.first()).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: path.join(OUT_SCREENSHOTS, `${screen.id}.png`),
      fullPage: true,
    });

    const screenRecord = {
      id: screen.id,
      label: screen.label,
      route: screen.route,
      mockupRoute: screen.mockupRoute,
      functions: screen.functions,
      mockupGap: screen.mockupGap || null,
      buttons: [],
      mockDataVisible: [],
      configured: true,
    };

    const bodyText = await page.locator('body').innerText();
    if (/14/.test(bodyText) && /streak/i.test(bodyText)) screenRecord.mockDataVisible.push('streak_14');
    if (/62/.test(bodyText)) screenRecord.mockDataVisible.push('bfi_62');
    if (/Top 12%/.test(bodyText)) screenRecord.mockDataVisible.push('percentile_top_12');
    if (/Neck spot/.test(bodyText)) screenRecord.mockDataVisible.push('neck_spot');
    if (/CeraVe Retinol/.test(bodyText)) screenRecord.mockDataVisible.push('shelf_products');

    for (const btn of screen.buttons) {
      inventory.summary.totalButtons += 1;
      const entry = {
        name: String(btn.name),
        action: btn.action,
        result: 'pending',
        configured: !btn.skip,
        issue: null,
      };

      if (btn.skip) {
        entry.result = 'skipped';
        entry.issue = btn.skipReason;
        inventory.summary.skipped += 1;
        screenRecord.buttons.push(entry);
        continue;
      }

      try {
        await stubRedesignApis(page);
        await page.goto(screen.route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await expect(page.getByText(screen.readyText).first()).toBeVisible({ timeout: 30_000 });
        await runSetup(page, screen, btn);
        const urlBefore = page.url();
        await clickNamed(page, btn);
        await page.waitForTimeout(500);

        if (btn.expectUrl) {
          await expect(page).toHaveURL(btn.expectUrl, { timeout: 15_000 });
        }
        if (btn.expectText) {
          await expect(page.getByText(btn.expectText).first()).toBeVisible({ timeout: 10_000 });
        }

        entry.result = 'pass';
        entry.urlAfter = page.url();
        entry.navigated = urlBefore !== page.url();
        inventory.summary.passed += 1;
      } catch (e) {
        entry.result = btn.optional ? 'skipped' : 'fail';
        entry.issue = e.message;
        if (btn.optional) {
          inventory.summary.skipped += 1;
        } else {
          inventory.summary.failed += 1;
          if (!btn.skip) inventory.summary.notConfigured += 1;
        }
      }
      screenRecord.buttons.push(entry);
    }

    inventory.screens.push(screenRecord);
  });
}

async function runSetup(page, screen, btn) {
  if (screen.id === 'account') {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  if (screen.id === 'journey-choose' && btn.action === 'navigate_after_choose') {
    await page.getByText('Watch something on my skin').click();
    await page.getByText('Improve my skin routine').click();
  }
  if (screen.id === 'track-capture' && btn.action === 'save_photo') {
    await page.getByText('Neck').click().catch(() => {});
  }
}

test.afterAll(async () => {
  inventory.auditedAt = new Date().toISOString();
  fs.writeFileSync(OUT_JSON, JSON.stringify(inventory, null, 2));
});
