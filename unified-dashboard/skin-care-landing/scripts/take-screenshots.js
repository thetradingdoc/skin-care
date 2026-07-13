import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const shots = [
    { name: '01-hero', url: 'https://app.trytouche.com', scroll: 0 },
    { name: '02-how-it-works', url: 'https://app.trytouche.com', scroll: 900 },
    { name: '03-about', url: 'https://app.trytouche.com/about', scroll: 0 },
  ];

  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const page = await ctx.newPage();
    await page.goto(s.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    if (s.scroll > 0) await page.evaluate((y) => window.scrollTo(0, y), s.scroll);
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `scripts/screenshots/${s.name}.png`,
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log(`✅ ${s.name}.png`);
    await ctx.close();
  }

  await browser.close();
  console.log('Done. Open scripts/screenshots/ to review.');
})();
