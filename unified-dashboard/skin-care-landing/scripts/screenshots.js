import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const pages = [
    { name: '01-hero', url: 'https://app.trytouche.com', waitFor: 2000 },
    { name: '02-how-it-works', url: 'https://app.trytouche.com/#how', waitFor: 2000 },
    { name: '03-about', url: 'https://app.trytouche.com/about', waitFor: 2000 },
    { name: '04-contact', url: 'https://app.trytouche.com/contact', waitFor: 2000 },
  ];

  for (const p of pages) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    await page.goto(p.url, { waitUntil: 'networkidle' });
    if (p.name === '02-how-it-works') {
      await page.locator('#how').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
    } else {
      await page.waitForTimeout(p.waitFor);
    }
    await page.screenshot({
      path: `scripts/screenshots/${p.name}.png`,
      fullPage: false,
    });
    console.log(`Saved ${p.name}.png`);
    await context.close();
  }

  await browser.close();
  console.log('All screenshots saved to scripts/screenshots/');
})();
