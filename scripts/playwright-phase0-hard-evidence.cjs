#!/usr/bin/env node
/**
 * Hard-evidence harness for TOUCH-002/003 + TOUCH-004 (zero-history Back).
 * Prints raw navigation events — not summaries.
 */
'use strict';

const { createRequire } = require('module');
const path = require('path');
const { spawn } = require('child_process');

const REPO = path.join(__dirname, '..');
const MW = path.join(REPO, 'middleware-platform');
const requireMw = createRequire(path.join(MW, 'package.json'));
const { chromium } = requireMw('@playwright/test');
const { bootstrapMobileSession, stubMobileAppApis } = require(path.join(
  MW,
  'e2e/helpers/mobile-app-mocks.cjs',
));

const LOCAL_BROWSERS = path.join(MW, '.playwright-browsers');
if (fsExists(LOCAL_BROWSERS)) process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;

const APP_PORT = '5201';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;

function fsExists(p) {
  try {
    return require('fs').existsSync(p);
  } catch {
    return false;
  }
}

function resolveChromiumExecutable() {
  if (!fsExists(LOCAL_BROWSERS)) return undefined;
  const fs = require('fs');
  for (const entry of fs.readdirSync(LOCAL_BROWSERS)) {
    if (!entry.startsWith('chromium')) continue;
    const root = path.join(LOCAL_BROWSERS, entry);
    for (const plat of fs.readdirSync(root, { withFileTypes: true })) {
      if (!plat.isDirectory()) continue;
      const candidate = path.join(root, plat.name, 'chrome-headless-shell');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

async function startServer() {
  const dist = path.join(REPO, 'unified-dashboard', 'hosting-dist-consumer');
  const child = spawn(
    process.execPath,
    [path.join(MW, 'scripts', 'serve-consumer-hosting.cjs'), dist, APP_PORT],
    { cwd: MW, stdio: 'ignore', detached: true, env: { ...process.env, API_PROXY_TARGET: '' } },
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return child.pid;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server failed');
}

async function traceCold(browser, label, { seed, stub }) {
  console.log('\n========== ' + label + ' ==========');
  console.log('SETUP: page.goto("' + APP_BASE + '/app") — bare path only');
  console.log(
    'SETUP: destination URL pre-seeded? NO. session bootstrap for API stubs?',
    seed && seed.session === false ? 'NO (localStorage cleared)' : 'YES (session storage only — not a route)',
  );

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  if (seed && seed.session === false) {
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } else if (seed) {
    await bootstrapMobileSession(context, seed);
  }
  const page = await context.newPage();
  await stubMobileAppApis(page, stub || {});

  const urls = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      const u = frame.url();
      urls.push({ t: Date.now(), url: u });
      console.log('[nav]', u);
    }
  });

  const t0 = Date.now();
  await page.goto(`${APP_BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  console.log('[goto return]', page.url(), 'dt_ms=', Date.now() - t0);

  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(250);
    const u = page.url();
    if (u !== `${APP_BASE}/app` && u !== `${APP_BASE}/app/`) break;
  }
  await page.waitForTimeout(1500);
  console.log('[final]', page.url());
  console.log('[trace]', JSON.stringify(urls.map((x) => x.url)));
  await context.close();
  return { final: page.url?.() || urls[urls.length - 1]?.url, urls: urls.map((x) => x.url) };
}

async function zeroHistoryBack(browser) {
  console.log('\n========== TOUCH-004 zero-history Back ==========');
  console.log('SETUP: first navigation is /app/sign-in (no prior in-app history)');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  const page = await context.newPage();
  await stubMobileAppApis(page, {});

  const urls = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log('[nav]', frame.url());
      urls.push(frame.url());
    }
  });

  await page.goto(`${APP_BASE}/app/sign-in`, { waitUntil: 'networkidle', timeout: 45_000 });
  console.log('[after goto sign-in]', page.url());
  console.log('[canGoBack probe] history.length=', await page.evaluate(() => window.history.length));

  const back = page.getByRole('button', { name: /go back|back/i }).first();
  await back.click();
  await page.waitForTimeout(2000);
  const final = page.url();
  console.log('[after Back click]', final);
  const leftApp =
    /myskinandcare\.com|trytouche\.com(?!\/)/.test(final) && !final.includes('127.0.0.1');
  const stillInApp = final.includes('/app');
  console.log('[ASSERT still in /app]', stillInApp);
  console.log('[ASSERT not marketing host]', !leftApp);
  console.log('[ASSERT not LANDING marketing origin]', !/myskinandcare\.com\/?$/.test(final));
  await context.close();
  return { final, stillInApp, leftApp, urls };
}

async function main() {
  const pid = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromiumExecutable(),
  });
  try {
    await traceCold(browser, 'C1 no-session', {
      seed: { session: false },
      stub: {},
    });
    await traceCold(browser, 'C2 session-ok → postauth', {
      seed: { journeyModes: ['watch', 'routine'], withSpot: true },
      stub: {
        journeyModes: ['watch', 'routine'],
        hasTemplate: true,
        bioComplete: true,
        emptyShelf: false,
      },
    });
    await traceCold(browser, 'P1 journey-choose', {
      seed: { journeyModes: [] },
      stub: { journeyModes: [], hasTemplate: false },
    });
    await zeroHistoryBack(browser);
  } finally {
    await browser.close();
    try {
      process.kill(pid);
    } catch {
      /* */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
