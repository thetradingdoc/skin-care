'use strict';

const { test, expect } = require('@playwright/test');
const { stubRedesignApis, seedRedesignStorage } = require('./helpers/redesign-mock-stubs.cjs');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

async function seedSession(context) {
  await seedRedesignStorage(context, API_BASE);
}

test.describe('skin age Today and Progress tabs', () => {
  test.beforeEach(async ({ page, context }) => {
    await seedSession(context);
    await stubRedesignApis(page, API_BASE);
  });

  test('E2E-11 Home tab shows routine week kicker', async ({ page }) => {
    await page.goto('/app/(tabs)/home');
    await expect(page.getByText(/Week \d+ of/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('E2E-12 Progress tab loads summary', async ({ page }) => {
    await page.goto('/app/(tabs)/progress');
    await expect(page.getByText(/progress|skin age|logged/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
