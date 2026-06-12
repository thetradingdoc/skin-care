#!/usr/bin/env node
/**
 * Visual design audit for patient app v3 — screenshots + seam/overflow checks.
 * Run: npm run audit:v3-design --prefix middleware-platform
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MW_ROOT = path.join(REPO_ROOT, 'middleware-platform');

const require = createRequire(path.join(MW_ROOT, 'package.json'));
const { chromium } = require('playwright');

const LOCAL_BROWSERS = path.join(MW_ROOT, '.playwright-browsers');
if (fs.existsSync(LOCAL_BROWSERS)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
} else if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
}

function resolveChromiumExecutable() {
  if (!fs.existsSync(LOCAL_BROWSERS)) return undefined;
  for (const entry of fs.readdirSync(LOCAL_BROWSERS)) {
    if (!entry.startsWith('chromium')) continue;
    const root = path.join(LOCAL_BROWSERS, entry);
    const headless = path.join(root, `chrome-headless-shell-${process.platform === 'darwin' ? 'mac' : process.platform}-${process.arch}`, 'chrome-headless-shell');
    if (fs.existsSync(headless)) return headless;
    for (const plat of fs.readdirSync(root, { withFileTypes: true })) {
      if (!plat.isDirectory()) continue;
      const candidate = path.join(root, plat.name, 'chrome-headless-shell');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const BASE = process.env.PW_V3_BASE || 'http://127.0.0.1:5194';
const OUT_DIR = path.join(MW_ROOT, 'playwright-report', 'v3-design-audit');
const PAGE_BG = '#ffffff';
const CARD = '#fffdf9';

const TABS = [
  { name: 'home', path: '/app/(tabs)/home' },
  { name: 'track', path: '/app/(tabs)/track' },
  { name: 'scan', path: '/app/(tabs)/scan' },
  { name: 'progress', path: '/app/(tabs)/progress' },
  { name: 'account', path: '/app/(tabs)/account' },
];

function normHex(c) {
  if (!c) return '';
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    return (
      '#' +
      [m[1], m[2], m[3]]
        .map((n) => Number(n).toString(16).padStart(2, '0'))
        .join('')
        .toLowerCase()
    );
  }
  return c.toLowerCase();
}

async function ensureServer() {
  try {
    const res = await fetch(`${BASE}/app/(tabs)/home`, { signal: AbortSignal.timeout(3000) });
    if (res.ok || res.status < 500) return;
  } catch {
    /* start local server */
  }
  const { spawn } = await import('child_process');
  const consumerRoot = path.join(REPO_ROOT, 'unified-dashboard', 'hosting-dist-consumer');
  const serveScript = path.join(MW_ROOT, 'scripts', 'serve-consumer-hosting.cjs');
  const port = new URL(BASE).port || '5194';
  const child = spawn(process.execPath, [serveScript, consumerRoot, port], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/app/(tabs)/home`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return;
    } catch {
      /* retry */
    }
  }
  throw new Error(`Consumer hosting not reachable at ${BASE}. Run: npm run build:consumer-hosting`);
}

async function main() {
  await ensureServer();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('patient_session_id', 'pw_design_audit');
    localStorage.setItem(
      'patient_journey_profile_v1',
      JSON.stringify({ modes: ['watch', 'routine'], primary: 'routine', chosenAt: new Date().toISOString() }),
    );
  });

  await page.route('**/api/patient/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, has_template: true, products: [], summary: {}, days: [] }),
    }),
  );

  const issues = [];

  await page.goto(`${BASE}/app/timeline`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(800);
  const timelineUrl = page.url();
  if (!timelineUrl.includes('/progress')) {
    issues.push({ tab: 'timeline-redirect', issue: `/app/timeline did not redirect to progress (got ${timelineUrl})` });
  }

  for (const tab of TABS) {
    await page.goto(`${BASE}${tab.path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(1500);
    const shot = path.join(OUT_DIR, `${tab.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const metrics = await page.evaluate(() => {
      const tabBar = document.querySelector('[role="tablist"]')?.parentElement;
      const overflowX = document.documentElement.scrollWidth > window.innerWidth + 2;
      const overflowY = document.documentElement.scrollHeight > window.innerHeight + 400;
      const scene =
        [...document.querySelectorAll('#root div')].find((el) => {
          const bg = getComputedStyle(el).backgroundColor;
          return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(0, 0, 0)';
        }) || document.body;
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        sceneBg: getComputedStyle(scene).backgroundColor,
        tabBarBg: tabBar ? getComputedStyle(tabBar).backgroundColor : null,
        overflowX,
        overflowY,
        sqlError: document.body.innerText.includes('no such table'),
        journalTab: document.body.innerText.includes('_journal'),
      };
    });

    if (metrics.sqlError) issues.push({ tab: tab.name, issue: 'Raw SQL error visible' });
    if (metrics.journalTab) issues.push({ tab: tab.name, issue: '_journal label visible' });
    if (metrics.overflowX) issues.push({ tab: tab.name, issue: 'Horizontal overflow' });
    if (metrics.overflowY && tab.name !== 'home') {
      issues.push({ tab: tab.name, issue: 'Excessive vertical scroll (possible empty layout)' });
    }

    const bodyHex = normHex(metrics.bodyBg);
    const sceneHex = normHex(metrics.sceneBg);
    const tabHex = normHex(metrics.tabBarBg || '');
    if (bodyHex && bodyHex !== normHex(PAGE_BG) && bodyHex !== '#f8f3ea') {
      issues.push({ tab: tab.name, issue: `HTML body background ${bodyHex} (expected ~${PAGE_BG})` });
    }
    if (sceneHex && sceneHex !== normHex(PAGE_BG) && sceneHex !== normHex(CARD) && sceneHex !== '#f8f3ea') {
      issues.push({ tab: tab.name, issue: `App scene background ${sceneHex} (expected ~${PAGE_BG})` });
    }
    if (tabHex && tabHex !== normHex(CARD) && tabHex !== normHex('#f8f3ea')) {
      issues.push({ tab: tab.name, issue: `Tab bar background ${tabHex} (expected ~${CARD})` });
    }

    const blueCta = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[role="button"]')];
      return buttons.some((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        return bg === 'rgb(49, 77, 182)';
      });
    });
    if (blueCta && tab.name !== 'account') {
      issues.push({ tab: tab.name, issue: 'Billing blue CTA rgb(49,77,182) visible — expected black consumer CTA' });
    }
  }

  await page.goto(`${BASE}/app/(tabs)/progress`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(1000);
  const hasFlameIcon = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg, [class*="MaterialIcons"]');
    return svgs.length > 0 || document.body.innerText.includes('Day streak');
  });
  if (!hasFlameIcon) {
    issues.push({ tab: 'progress', issue: 'Streak row missing (expected Day streak label)' });
  }

  const reportPath = path.join(OUT_DIR, 'issues.json');
  fs.writeFileSync(reportPath, JSON.stringify({ issues, screenshots: OUT_DIR }, null, 2));
  console.log(JSON.stringify({ issues, reportPath }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
