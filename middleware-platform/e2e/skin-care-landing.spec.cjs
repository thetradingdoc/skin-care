'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Skin & Care consumer landing', () => {
  test('hero, CTAs, and footer are Skin & Care branded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: /Skin & Care home/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Track your skin, every day/i })).toBeVisible();
    await expect(page.getByText(/Somo/i)).toHaveCount(0);

    const getStarted = page.getByRole('link', { name: /Get started/i }).first();
    await expect(getStarted).toHaveAttribute('href', /patient-login\.html\?intent=signup/);

    const signIn = page.locator('.sc-nav').getByRole('link', { name: /Sign in/i });
    await expect(signIn).toHaveAttribute('href', /patient-login\.html/);

    await expect(page.getByRole('heading', { name: /Your skin journal, simplified/i })).toBeVisible();
    await expect(page.getByText(/Log today/i)).toBeVisible();

    await expect(page.locator('.sc-footer')).toContainText('Skin & Care');
    await expect(page.locator('.sc-footer').getByRole('link', { name: /Privacy/i })).toHaveAttribute(
      'href',
      /legal\/privacy\.html/
    );
  });

  test('mobile layout shows primary CTA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Get started free/i })).toBeVisible();
  });
});
