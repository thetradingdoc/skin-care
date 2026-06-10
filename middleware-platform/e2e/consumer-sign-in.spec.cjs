'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Consumer sign-in (/app/sign-in)', () => {
  test('returning user — wordmark, tulip favicon, back to landing', async ({ page }) => {
    await page.goto('/app/sign-in');
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toBeAttached();
    await expect(page.getByRole('button', { name: 'Go back' })).toBeVisible();
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/app/sign-in');
    await expect(page.locator('.sc-logo-wordmark')).toBeVisible();
    const skinStyle = await page.locator('.sc-logo-skin').evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontWeight: s.fontWeight, fontStyle: s.fontStyle, fontFamily: s.fontFamily };
    });
    expect(skinStyle.fontWeight).toBe('700');
    expect(skinStyle.fontStyle).toBe('italic');
    expect(skinStyle.fontFamily.toLowerCase()).toContain('be vietnam');
    await expect(page.getByText('care', { exact: false })).toBeVisible();
    await expect(page.getByText('Sign in')).toBeVisible();
    await expect(page.getByText(/New here\? Start on the web/i)).toHaveCount(0);
    await expect(page.getByText('Track today. Glow tomorrow.')).toBeVisible();
  });

  test('funnel signup copy', async ({ page }) => {
    await page.goto('/app/sign-in?intent=signup&from=skin-age-landing');
    await expect(page.getByText('Save your plan')).toBeVisible();
    await expect(page.getByText(/save your skin age/i)).toBeVisible();
    await expect(page.getByText(/New here\?/i)).toHaveCount(0);
  });

  test('legacy patient-login redirects to app sign-in', async ({ page }) => {
    await page.goto('/patients/patient-login.html?intent=signup');
    await expect(page).toHaveURL(/\/app\/sign-in/);
    await expect(page.getByText('Create account')).toBeVisible();
  });

  test('patient-login stub preserves funnel signup intent', async ({ page }) => {
    const html = await page.goto('/patients/patient-login.html?from=skin-age-landing&intent=signup');
    await expect(page).toHaveURL(/\/app\/sign-in/);
    await expect(page.getByText('Save your plan')).toBeVisible();
    expect(html?.ok()).toBeTruthy();
  });
});
