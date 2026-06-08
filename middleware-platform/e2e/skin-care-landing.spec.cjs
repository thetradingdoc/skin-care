'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Skin & Care consumer landing', () => {
  test('hero, CTAs, and footer are Skin & Care branded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: /skin care home/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Track today\./i })).toBeVisible();
    await expect(page.getByText(/Glow tomorrow/i)).toBeVisible();
    await expect(page.getByText(/Somo/i)).toHaveCount(0);

    const faceAgeCta = page.getByRole('link', { name: /Find your face age/i });
    await expect(faceAgeCta).toHaveAttribute('href', '/scan');

    await expect(page.locator('.sc-hero-photo')).toBeVisible();

    await expect(page.getByRole('heading', { name: /Track Your Skin/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Smart Insights/i })).toBeVisible();

    await expect(page.locator('.sc-footer')).toContainText('Skin&Care');
    await expect(page.locator('.sc-footer').getByRole('link', { name: /Privacy/i })).toHaveAttribute(
      'href',
      /legal\/privacy\.html/
    );
  });

  test('mobile layout shows primary CTA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Find your face age/i })).toBeVisible();
  });
});
