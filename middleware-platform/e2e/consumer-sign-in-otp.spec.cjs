'use strict';

const { test, expect } = require('@playwright/test');

const LIVE = process.env.CONSUMER_SIGNIN_LIVE === '1';

test.describe('Consumer sign-in OTP flow (/app/sign-in)', () => {
  test('send code advances to verification step (mocked API)', async ({ page }) => {
    const corsErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (/cors|access-control|blocked by/i.test(text)) corsErrors.push(text);
    });

    await page.route('**/api/patient/verify/send', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'content-type',
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session_id: 'pw-otp-session',
          message: 'Verification code sent to your email',
        }),
      });
    });

    await page.goto('/app/sign-in');
    await expect(page.getByText('Sign in')).toBeVisible();

    const emailInput = page.getByPlaceholder('you@example.com');
    await emailInput.fill('otp-e2e@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page.getByText('Enter code')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder('123456')).toBeVisible();
    await expect(page.getByText(/otp-e2e@example\.com/i)).toBeVisible();
    expect(corsErrors).toEqual([]);
  });

  test('confirm code completes sign-in (mocked API)', async ({ page }) => {
    await page.route('**/api/patient/verify/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, session_id: 'pw-otp-session' }),
      });
    });
    await page.route('**/api/patient/verify/confirm', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          session_id: 'pw-confirmed-session',
          patient_id: 'patient-pw',
          email: 'otp-e2e@example.com',
        }),
      });
    });
    await page.route('**/api/patient/routine/template', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, has_template: false }),
      });
    });

    await page.goto('/app/sign-in');
    await page.getByPlaceholder('you@example.com').fill('otp-e2e@example.com');
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(page.getByPlaceholder('123456')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('123456').fill('123456');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/app\/routine\/pick/, { timeout: 15_000 });
  });

  (LIVE ? test : test.skip)(
    'live production CORS allows myskinandcare.com (CONSUMER_SIGNIN_LIVE=1)',
    async ({ request }) => {
      const origins = ['https://www.myskinandcare.com', 'https://myskinandcare.com'];
      for (const origin of origins) {
        const res = await request.fetch('https://api.callsomo.com/api/patient/verify/send', {
          method: 'OPTIONS',
          headers: {
            Origin: origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
          },
        });
        expect(res.status(), `preflight for ${origin}`).toBe(204);
        expect(res.headers()['access-control-allow-origin']).toBe(origin);
      }
    }
  );
});
