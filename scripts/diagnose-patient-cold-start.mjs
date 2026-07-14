/**
 * Cold-start diagnostic for patient-app web (same Expo Router JS as iOS).
 * Playwright cannot drive the physical iPhone; this reproduces blank screen in Chrome.
 *
 *   APP_URL=http://127.0.0.1:8082 node scripts/diagnose-patient-cold-start.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const APP_URL = (process.env.APP_URL || 'http://127.0.0.1:8082').replace(/\/$/, '');
const outDir = path.resolve('screenshots/cold-start-diag');
fs.mkdirSync(outDir, { recursive: true });

const consoleLogs = [];
const pageErrors = [];
const reqFails = [];

async function sample(page, label) {
  const file = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const info = await page.evaluate(() => {
    const body = document.body;
    const text = (body?.innerText || '').trim().slice(0, 1200);
    const bg = getComputedStyle(body).backgroundColor;
    const root =
      document.getElementById('root') ||
      document.getElementById('main') ||
      document.querySelector('#__next') ||
      document.body;
    const childCount = root ? root.querySelectorAll('*').length : 0;
    const htmlLen = (root?.innerHTML || '').length;
    return {
      text,
      bg,
      childCount,
      htmlLen,
      url: location.href,
      title: document.title,
    };
  });
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(info, null, 2));
  return { file, info };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 14'],
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.stack || err?.message || err));
  });
  page.on('requestfailed', (req) => {
    reqFails.push({ url: req.url(), error: req.failure()?.errorText });
  });

  console.log('GOTO', APP_URL);
  const started = Date.now();
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 90_000 });

  const samples = [];
  for (const t of [1000, 2500, 5000, 8000, 12000]) {
    const elapsed = Date.now() - started;
    if (elapsed < t) await page.waitForTimeout(t - elapsed);
    samples.push(await sample(page, `t${t}ms`));
  }

  const report = {
    appUrl: APP_URL,
    samples: samples.map((s) => ({ file: s.file, info: s.info })),
    pageErrors,
    reqFails: reqFails.slice(0, 50),
    consoleErrors: consoleLogs.filter((l) => l.type === 'error').slice(0, 50),
    consoleWarn: consoleLogs.filter((l) => l.type === 'warning').slice(0, 30),
    consoleAllTail: consoleLogs.slice(-40),
  };
  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('\nWROTE', reportPath);
  console.log('PAGE_ERRORS', pageErrors.length);
  if (pageErrors[0]) console.log('FIRST_PAGE_ERROR', pageErrors[0].slice(0, 500));
  console.log('CONSOLE_ERRORS', report.consoleErrors.length);
  report.consoleErrors.slice(0, 8).forEach((e) => console.log(' ERR', e.text.slice(0, 300)));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
