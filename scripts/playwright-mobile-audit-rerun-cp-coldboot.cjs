#!/usr/bin/env node
/**
 * TOUCH-003 — C1–C5 + P1–P7 on REAL cold boot via bare `/app`.
 * Does not navigate to seeded destination URLs (/app/home, /app/sign-in, etc.).
 * Session/API state is injected before first navigation; router must land via
 * resolveInitialRoute / resolvePostAuthRoute.
 */
'use strict';

const { createRequire } = require('module');
const fs = require('fs');
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
if (fs.existsSync(LOCAL_BROWSERS)) process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;

const APP_PORT = process.env.PW_CONSUMER_PORT || '5199';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const OUT = path.join(REPO, 'todos', 'pending', 'mobile-ux-audit-2026-07-14');
const SHOTS = path.join(OUT, 'screenshots');
const REPORT_PATH = path.join(OUT, 'rerun-cp-coldboot.json');

function resolveChromiumExecutable() {
  if (!fs.existsSync(LOCAL_BROWSERS)) return undefined;
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
    { cwd: MW, stdio: 'ignore', detached: true, env: { ...process.env, API_PROXY_TARGET: '' } }
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app`, { signal: AbortSignal.timeout(2000), redirect: 'follow' });
      if (res.status < 500) {
        const html = await res.text();
        if (html.includes('entry-') || html.includes('_expo')) return child.pid;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server start failed — bare /app did not return Expo shell');
}

async function waitForAny(page, patterns, timeout = 22_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
    const url = page.url();
    for (const p of patterns) {
      if (p.test(body) || p.test(url)) return { ok: true, body: body.slice(0, 280), url };
    }
    await page.waitForTimeout(400);
  }
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
  return { ok: false, body: body.slice(0, 280), url: page.url() };
}

async function fresh(browser, seed) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
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
  return { context, page };
}

const results = [];

async function runCase(browser, c) {
  const { context, page } = await fresh(browser, c.seed);
  try {
    await stubMobileAppApis(page, c.stub || {});
    // REAL cold boot — bare /app only (TOUCH-003).
    await page.goto(`${APP_BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const found = await waitForAny(page, c.expectText, c.timeout || 22_000);
    const shot = path.join(SHOTS, c.file);
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot, fullPage: false });
    const entry = {
      id: c.id,
      severity: found.ok ? 'info' : c.optional ? 'low' : 'high',
      issue: found.ok ? 'ok' : 'Expected UI text not found after cold /app boot',
      bootUrl: `${APP_BASE}/app`,
      landedUrl: found.url,
      seededDestination: false,
      body: found.body,
    };
    results.push(entry);
    console.log(`${c.id}: ${entry.severity} → ${found.url}`);
  } catch (e) {
    results.push({
      id: c.id,
      severity: 'high',
      issue: e.message,
      bootUrl: `${APP_BASE}/app`,
      seededDestination: false,
    });
    console.log(`${c.id}: high ${e.message}`);
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const pid = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromiumExecutable(),
  });

  const cases = [
    {
      id: 'C1',
      file: '01-cold-no-session-signin.png',
      seed: { session: false },
      stub: {},
      expectText: [/sign in/i, /send code/i],
    },
    {
      id: 'C2',
      file: '02-cold-me-ok-postauth.png',
      seed: { journeyModes: ['watch', 'routine'], withSpot: true },
      stub: {
        journeyModes: ['watch', 'routine'],
        hasTemplate: true,
        bioComplete: true,
        emptyShelf: false,
      },
      expectText: [/good (morning|afternoon|evening)|barrier|day \d+|home/i],
    },
    {
      id: 'C3',
      file: '03-cold-me-auth-dead-signin.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'auth_dead' },
      expectText: [/sign in/i, /send code/i],
    },
    {
      id: 'C4',
      file: '04-cold-me-flaky-connection.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'network_fail' },
      expectText: [/connection error|sign in|retry/i],
    },
    {
      id: 'C5',
      file: '05-cold-index-timeout-signin.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'hang', hangMs: 7000 },
      expectText: [/sign in|home|barrier|journey/i],
      timeout: 12_000,
      optional: true,
    },
    {
      id: 'P1',
      file: '06-postauth-journey-choose.png',
      seed: { journeyModes: [] },
      stub: { journeyModes: [], hasTemplate: false },
      expectText: [/choose|journey|diary|routine|spot|continue/i],
    },
    {
      id: 'P2',
      file: '07-postauth-routine-pick.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: false, bioComplete: true },
      expectText: [/care plan|acne|start tracking|pick/i],
    },
    {
      id: 'P3',
      file: '08-postauth-bio-calibration.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: false },
      expectText: [/calibrat|skin profile|skin concerns|continue/i],
    },
    {
      id: 'P4',
      file: '09-postauth-empty-shelf-scan.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: true, emptyShelf: true },
      expectText: [/scan|add product|barcode|search by name|shelf/i],
    },
    {
      id: 'P5',
      file: '10-postauth-spot-only-track.png',
      seed: { journeyModes: ['spot'], clearSpots: true },
      stub: { journeyModes: ['spot'], hasTemplate: false },
      expectText: [/track|spot|mole|photo/i],
    },
    {
      id: 'P6',
      file: '11-postauth-watch-only-home.png',
      seed: { journeyModes: ['watch'] },
      stub: { journeyModes: ['watch'], hasTemplate: false },
      expectText: [/home|diary|photo|good (morning|afternoon|evening)|journal/i],
    },
    {
      id: 'P7',
      file: '12-postauth-setup-complete-home.png',
      seed: { journeyModes: ['watch', 'routine'], withSpot: true },
      stub: {
        journeyModes: ['watch', 'routine'],
        hasTemplate: true,
        bioComplete: true,
        emptyShelf: false,
      },
      expectText: [/barrier|day \d+|good (morning|afternoon|evening)|photo/i],
    },
  ];

  try {
    for (const c of cases) {
      console.log('Running', c.id, 'cold /app');
      await runCase(browser, c);
    }
  } finally {
    await browser.close();
    try {
      process.kill(pid);
    } catch {
      /* ignore */
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    method: 'bare_/app_cold_boot',
    seededDestinationUrls: false,
    spaFix: 'TOUCH-002 serve-consumer-hosting + firebase.consumer.json',
    results,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  const gapsPath = path.join(OUT, 'COVERAGE_GAPS.md');
  const note = `

## TOUCH-003 cold-boot retest (${report.generatedAt.slice(0, 10)})

After TOUCH-002 SPA fix, C1–C5 / P1–P7 re-ran via **bare \`/app\` only** (script \`scripts/playwright-mobile-audit-rerun-cp-coldboot.cjs\`).
No seeded destination URLs. Report: \`rerun-cp-coldboot.json\`.
`;
  if (fs.existsSync(gapsPath)) {
    let gaps = fs.readFileSync(gapsPath, 'utf8');
    if (!gaps.includes('TOUCH-003 cold-boot retest')) {
      fs.writeFileSync(gapsPath, gaps.trimEnd() + note);
    }
  }

  const highs = results.filter((r) => r.severity === 'high');
  console.log('Wrote', REPORT_PATH);
  console.log(results.map((r) => `${r.id}: ${r.severity} ${r.landedUrl || r.issue}`).join('\n'));
  if (highs.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
