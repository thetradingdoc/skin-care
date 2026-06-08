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

    const faceAgeCta = page.getByRole('link', { name: /Facial Age Checker/i });
    await expect(faceAgeCta).toHaveAttribute('href', '/scan');

    await expect(page.locator('.sc-hero-photo')).toBeVisible();

    await expect(page.getByRole('heading', { name: /Face scan → skin age/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Tell us what to track/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /One photo a day/i })).toBeVisible();

    await expect(page.getByRole('heading', { name: /How it works/i })).toBeVisible();
    await expect(page.getByText(/look younger/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Check your face age/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Facial Age Checker/i })).toHaveCount(1);

    await expect(page.locator('.sc-footer')).toContainText('Skin&Care');
    await expect(page.locator('.sc-footer').getByRole('link', { name: /Privacy/i })).toHaveAttribute(
      'href',
      /legal\/privacy\.html/
    );
  });

  test('mobile layout shows primary CTA', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Facial Age Checker/i })).toBeVisible();
  });

  test('about page is informative with split hero', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/about.html');

    await expect(page.getByText(/About Skin & Care/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Research for skin that was left out/i })).toBeVisible();
    await expect(page.getByText(/consumer research lab/i)).toBeVisible();
    await expect(page.getByText(/melanin-rich skin/i)).toBeVisible();
    await expect(page.getByText(/dermatology and machine learning/i)).toBeVisible();
    await expect(page.locator('.sc-about-hero-photo')).toBeVisible();
    await expect(page.locator('.sc-about-hero-photo')).toHaveAttribute('src', /about-hero\.png/);
    await expect(page.getByRole('link', { name: /Facial Age Checker/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^See it$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Skin.*Care home/i })).toBeVisible();
  });
});
