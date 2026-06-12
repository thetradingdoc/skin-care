'use strict';

const { test, expect } = require('@playwright/test');
const { stubRedesignApis, seedRedesignStorage } = require('./helpers/redesign-mock-stubs.cjs');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

test.describe('skin age funnel OTP to home', () => {
  test('signup OTP completes and routes past sign-in', async ({ page, context }) => {
    await seedRedesignStorage(context, API_BASE);
    await stubRedesignApis(page, API_BASE);

    await page.route('**/api/patient/verify/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, session_id: 'pw-skin-age-otp' }),
      });
    });
    await page.route('**/api/patient/verify/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session_id: 'pw-skin-age-otp',
          email: 'skinage@example.com',
        }),
      });
    });

    await page.goto('/app/sign-in?intent=signup');
    await page.getByPlaceholder('you@example.com').fill('skinage@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByPlaceholder('123456')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('123456').fill('123456');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).not.toHaveURL(/\/sign-in/, { timeout: 20_000 });
  });
});
