'use strict';

const { test, expect } = require('@playwright/test');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

test.describe('care program subscription (Account tab)', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addInitScript(
      ({ api, sessionId }) => {
        localStorage.setItem('patient_session_id', sessionId);
        localStorage.setItem('patient_session_email', 'billing-e2e@example.com');
        localStorage.setItem('patient_api_base_url', api);
        localStorage.setItem('api_base', api);
      },
      { api: API_BASE, sessionId: 'pw-care-program-session' },
    );

    await page.route('**/api/patient/billing/subscription**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          subscription: { tier: 'free', status: 'active' },
        }),
      });
    });

    await page.route('**/api/patient/features**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, wallet_enabled: false }),
      });
    });

    await page.route('**/api/patient/billing/care-program/checkout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          checkout_url: 'https://checkout.stripe.com/c/pay/test_session',
          session_id: 'cs_test_e2e',
        }),
      });
    });
  });

  test('Subscribe opens checkout URL flow', async ({ page }) => {
    let checkoutRequested = false;
    await page.route('**/api/patient/billing/care-program/checkout', async (route) => {
      checkoutRequested = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          checkout_url: 'https://checkout.stripe.com/c/pay/test_session',
          session_id: 'cs_test_e2e',
        }),
      });
    });

    await page.goto('/app/(tabs)/account');
    await expect(page.getByRole('button', { name: /Subscribe/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Subscribe/i }).click();
    await expect.poll(() => checkoutRequested).toBe(true);
  });
});
