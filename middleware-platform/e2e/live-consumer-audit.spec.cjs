'use strict';

/**
 * Live production audit — Skin & Care consumer hosts vs legacy Somo.
 * Run: LIVE_BASE_URL=https://www.myskinandcare.com npx playwright test e2e/live-consumer-audit.spec.cjs --config playwright.live-consumer.config.cjs
 */

const { test, expect } = require('@playwright/test');

const HOST = process.env.LIVE_BASE_URL || 'https://myskinandcare.com';

test.describe(`Live consumer audit @ ${HOST}`, () => {
  test('home: Skin & Care brand, no Somo copy', async ({ page }) => {
    await page.goto(`${HOST}/`, { waitUntil: 'domcontentloaded' });
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Track today/i);
    expect(body).not.toMatch(/Never answer business calls/i);
    expect(body).not.toMatch(/\bTry for \$0\b/i);
    await expect(page.getByRole('link', { name: /Facial Age Checker/i }).first()).toBeVisible();
    await expect(page.getByText(/\bSomo\b/i)).toHaveCount(0);
  });

  test('every header nav link resolves', async ({ page }) => {
    await page.goto(`${HOST}/`);
    const nav = page.locator('.sc-header-nav a, header a');
    const count = await nav.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const link = nav.nth(i);
      const href = await link.getAttribute('href');
      const name = (await link.innerText()).trim();
      if (!href || href.startsWith('mailto:') || href === '#') continue;
      const target = href.startsWith('http') ? href : new URL(href, HOST).href;
      const res = await page.request.get(target);
      expect(res.status(), `nav "${name}" → ${target}`).toBeLessThan(400);
    }
  });

  test('primary CTAs work', async ({ page }) => {
    await page.goto(`${HOST}/`);
    const faceAge = page.getByRole('link', { name: /Facial Age Checker/i }).first();
    await expect(faceAge).toHaveAttribute('href', /\/scan/);
    await faceAge.click();
    await expect(page).toHaveURL(/\/scan/);
    await expect(page.locator('body')).not.toContainText(/Never answer business calls/i);
  });

  test('footer links resolve', async ({ page }) => {
    await page.goto(`${HOST}/`);
    for (const label of [/Privacy/i, /Terms/i, /Sign in/i, /Contact/i]) {
      const link = page.locator('.sc-footer').getByRole('link', { name: label }).first();
      if ((await link.count()) === 0) continue;
      const href = await link.getAttribute('href');
      expect(href, `footer ${label}`).toBeTruthy();
      const target = href.startsWith('http') ? href : new URL(href, HOST).href;
      const res = await page.request.get(target);
      expect(res.status(), `footer ${label} → ${target}`).toBeLessThan(400);
    }
  });

  test('static pages: about + contact', async ({ page }) => {
    for (const path of ['/about.html', '/contact.html']) {
      const res = await page.request.get(`${HOST}${path}`);
      expect(res.status(), path).toBeLessThan(400);
      await page.goto(`${HOST}${path}`);
      await expect(page.locator('body')).not.toContainText(/Never answer business calls/i);
    }
  });

  test('scan route loads', async ({ page }) => {
    const res = await page.request.get(`${HOST}/scan`);
    expect(res.status()).toBeLessThan(400);
    await page.goto(`${HOST}/scan`);
    await expect(page.locator('body')).not.toContainText(/Never answer business calls/i);
  });
});
