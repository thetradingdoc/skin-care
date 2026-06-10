'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Skin & Care consumer landing', () => {
  test('hero, CTAs, and footer are Skin & Care branded', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect(page.getByRole('link', { name: /skin care home/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Track today\./i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Track today/i })).toContainText(/Glow tomorrow/i);
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
    await expect(page.locator('.sc-footer-tagline')).toHaveText('Track today. Glow tomorrow.');
    await expect(page.getByText(/Not a medical diagnosis/i)).toHaveCount(0);
    await expect(page.locator('.sc-footer').getByRole('link', { name: /Privacy/i })).toHaveAttribute(
      'href',
      /legal\/privacy\.html/
    );

    const skinStyle = await page.locator('.sc-site-header .sc-logo-skin').evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontWeight: s.fontWeight, fontStyle: s.fontStyle };
    });
    expect(skinStyle.fontWeight).toBe('700');
    expect(skinStyle.fontStyle).toBe('italic');
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

    const skinStyle = await page.locator('.sc-logo-skin').evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontWeight: s.fontWeight, fontStyle: s.fontStyle };
    });
    expect(skinStyle.fontWeight).toBe('700');
    expect(skinStyle.fontStyle).toBe('italic');
  });
});

test.describe('landing navigation and buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('header logo returns home', async ({ page }) => {
    await page.goto('/about.html');
    await page.getByRole('link', { name: /Skin.*Care home/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Track today\./i })).toBeVisible();
  });

  test('header How It Works scrolls to #how section', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'How It Works' }).click();
    await expect(page).toHaveURL(/#how$/);
    await expect(page.locator('#how')).toBeInViewport();
    await expect(page.getByRole('heading', { name: /Check your face age/i })).toBeVisible();
  });

  test('header About link opens about page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about\.html$/);
    await expect(page.getByRole('heading', { name: /Research for skin that was left out/i })).toBeVisible();
  });

  test('header Contact link opens contact page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact\.html$/);
    await expect(page.getByRole('heading', { name: /Get in touch/i })).toBeVisible();
    const skinStyle = await page.locator('.sc-logo-skin').evaluate((el) => {
      const s = getComputedStyle(el);
      return { fontWeight: s.fontWeight, fontStyle: s.fontStyle };
    });
    expect(skinStyle.fontWeight).toBe('700');
    expect(skinStyle.fontStyle).toBe('italic');
  });

  test('account icon links to consumer sign-in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/app/sign-in');
  });

  test('Facial Age Checker navigates to scan funnel', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Facial Age Checker/i }).click();
    await expect(page).toHaveURL(/\/scan$/);
    await expect(
      page.getByRole('heading', { name: /Photo analysis consent|Add a photo|Facial Age Checker/i }),
    ).toBeVisible();
  });

  test('App Store badge links to waitlist', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByRole('link', { name: /Download on the App Store/i }).first();
    await expect(badge).toHaveAttribute('href', '/waitlist.html');
    await badge.click();
    await expect(page).toHaveURL(/\/waitlist\.html$/);
    await expect(page.getByRole('heading', { name: /Join the Skin.*Care waitlist/i })).toBeVisible();
  });

  test('Google Play badge links to waitlist', async ({ page }) => {
    await page.goto('/');
    const badge = page.getByRole('link', { name: /Get it on Google Play/i }).first();
    await expect(badge).toHaveAttribute('href', '/waitlist.html');
    await badge.click();
    await expect(page).toHaveURL(/\/waitlist\.html$/);
  });

  test('footer links navigate correctly', async ({ page }) => {
    await page.goto('/');

    await page.locator('.sc-footer').getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about\.html$/);

    await page.goto('/');
    await page.locator('.sc-footer').getByRole('link', { name: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact\.html$/);

    await page.goto('/');
    await page.locator('.sc-footer').getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/patients\/legal\/privacy\.html$/);

    await page.goto('/');
    await page.locator('.sc-footer').getByRole('link', { name: 'Terms' }).click();
    await expect(page).toHaveURL(/\/patients\/legal\/terms\.html$/);

    await page.goto('/');
    await expect(page.locator('.sc-footer').getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/app/sign-in'
    );
  });
});

test.describe('contact and waitlist forms', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('contact form submits to waitlist API with contact source', async ({ page }) => {
    /** @type {import('@playwright/test').Request | null} */
    let captured = null;

    await page.route('**/api/public/waitlist', async (route) => {
      captured = route.request();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/contact.html');
    await page.locator('#name').fill('Playwright Tester');
    await page.locator('#email').fill('e2e-tester@example.com');
    await page.locator('#subject').selectOption('App support');
    await page.locator('#message').fill('Testing contact form delivery.');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.locator('#form-status')).toHaveText(/Thank you/i);
    expect(captured).toBeTruthy();
    expect(captured.method()).toBe('POST');
    const body = captured.postDataJSON();
    expect(body.name).toBe('Playwright Tester');
    expect(body.email).toBe('e2e-tester@example.com');
    expect(body.source).toBe('contact');
    expect(body.product).toMatch(/Subject: App support/);
    expect(body.product).toMatch(/Testing contact form delivery/);
  });

  test('contact form uses production API host on consumer domain', async ({ page }) => {
    let requestUrl = '';
    await page.route('**/api/public/waitlist', async (route) => {
      requestUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.addInitScript(() => {
      window.__SKIN_CARE_API_BASE__ = 'https://api.callsomo.com';
    });

    await page.goto('/contact.html');
    await page.locator('#name').fill('Host Test');
    await page.locator('#email').fill('host@example.com');
    await page.locator('#message').fill('API host check');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('#form-status')).toHaveText(/Thank you/i);
    expect(requestUrl).toBe('https://api.callsomo.com/api/public/waitlist');
  });

  test('waitlist page submits with web_waitlist_page source', async ({ page }) => {
    let body = null;
    await page.route('**/api/public/waitlist', async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/waitlist.html');
    await page.locator('#name').fill('Waitlist User');
    await page.locator('#email').fill('waitlist@example.com');
    await page.locator('#note').fill('Interested in beta access');
    await page.getByRole('button', { name: 'Request Access' }).click();

    await expect(page.locator('#statusMsg')).toHaveText(/Success/i);
    expect(body.source).toBe('web_waitlist_page');
    expect(body.product).toBe('Interested in beta access');
  });

  test('waitlist Back to Home returns landing', async ({ page }) => {
    await page.goto('/waitlist.html');
    await page.getByRole('link', { name: 'Back to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /Track today\./i })).toBeVisible();
  });
});
