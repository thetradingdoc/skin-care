#!/usr/bin/env node
/**
 * Re-capture C1–C5 + P1–P7 with robust boot (index + sign-in session redirect).
 * Overwrites blanks in todos/pending/mobile-ux-audit-2026-07-14/screenshots/
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

const APP_PORT = process.env.PW_CONSUMER_PORT || '5196';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const OUT = path.join(REPO, 'todos', 'pending', 'mobile-ux-audit-2026-07-14');
const SHOTS = path.join(OUT, 'screenshots');
const ISSUES_PATH = path.join(OUT, 'rerun-cp-issues.json');

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
  const serveScript = path.join(MW, 'scripts', 'serve-consumer-hosting.cjs');
  const child = spawn(process.execPath, [serveScript, dist, APP_PORT], {
    cwd: MW,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app/sign-in`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return child.pid;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server start failed');
}

async function waitForAny(page, patterns, timeout = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
    for (const p of patterns) {
      if (p.test(body) || p.test(page.url())) return { ok: true, body, url: page.url() };
    }
    await page.waitForTimeout(400);
  }
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
  return { ok: false, body: body.slice(0, 200), url: page.url() };
}

async function shotFile(page, fileName) {
  const full = path.join(SHOTS, fileName);
  await page.waitForTimeout(500);
  await page.screenshot({ path: full, fullPage: false });
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
    });
  } else if (seed) {
    await bootstrapMobileSession(context, seed);
  }
  const page = await context.newPage();
  return { context, page };
}

const issues = [];

async function runCase(browser, c) {
  const { context, page } = await fresh(browser, c.seed);
  try {
    await stubMobileAppApis(page, c.stub || {});
    // Expo static: bare /app often paints blank; boot via index + session redirect via sign-in.
    if (c.boot === 'index') {
      await page.goto(`${APP_BASE}/app/index`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } else {
      await page.goto(`${APP_BASE}/app/sign-in`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    }
    const found = await waitForAny(page, c.expectText, c.timeout || 22_000);
    await shotFile(page, c.file);
    if (!found.ok) {
      issues.push({
        id: c.id,
        severity: c.optional ? 'low' : 'high',
        issue: 'Expected UI text not found after boot',
        url: found.url,
        body: found.body,
      });
    } else {
      issues.push({ id: c.id, severity: 'info', issue: 'ok', url: found.url });
    }
  } catch (e) {
    issues.push({ id: c.id, severity: 'high', issue: e.message });
    try {
      await shotFile(page, c.file);
    } catch {
      /* ignore */
    }
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
      boot: 'index',
      expectText: [/sign in/i, /send code/i],
    },
    {
      id: 'C2',
      file: '02-cold-me-ok-postauth.png',
      seed: { journeyModes: ['watch', 'routine'], withSpot: true },
      stub: { journeyModes: ['watch', 'routine'], hasTemplate: true, bioComplete: true, emptyShelf: false },
      boot: 'sign-in',
      expectText: [/good (morning|afternoon|evening)|barrier|home|day \d+/i, /track|scan|progress/i],
    },
    {
      id: 'C3',
      file: '03-cold-me-auth-dead-signin.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'auth_dead' },
      boot: 'index',
      expectText: [/sign in/i, /send code/i],
    },
    {
      id: 'C4',
      file: '04-cold-me-flaky-connection.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'network_fail' },
      boot: 'index',
      expectText: [/connection error|sign in|retry/i],
    },
    {
      id: 'C5',
      file: '05-cold-index-timeout-signin.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'hang', hangMs: 7000 },
      boot: 'index',
      expectText: [/sign in|home|barrier|journey/i],
      timeout: 12_000,
      optional: true,
    },
    {
      id: 'P1',
      file: '06-postauth-journey-choose.png',
      seed: { journeyModes: [] },
      stub: { journeyModes: [], hasTemplate: false },
      boot: 'sign-in',
      expectText: [/choose|journey|diary|routine|spot|continue/i],
    },
    {
      id: 'P2',
      file: '07-postauth-routine-pick.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: false, bioComplete: true },
      boot: 'sign-in',
      expectText: [/care plan|acne|start tracking|pick/i],
    },
    {
      id: 'P3',
      file: '08-postauth-bio-calibration.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: false },
      boot: 'sign-in',
      expectText: [/calibrat|skin profile|skin concerns|continue/i],
    },
    {
      id: 'P4',
      file: '09-postauth-empty-shelf-scan.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: true, emptyShelf: true },
      boot: 'sign-in',
      expectText: [/scan|add product|barcode|search by name|shelf/i],
    },
    {
      id: 'P5',
      file: '10-postauth-spot-only-track.png',
      seed: { journeyModes: ['spot'], clearSpots: true },
      stub: { journeyModes: ['spot'], hasTemplate: false },
      boot: 'sign-in',
      expectText: [/track|spot|mole|photo/i],
    },
    {
      id: 'P6',
      file: '11-postauth-watch-only-home.png',
      seed: { journeyModes: ['watch'] },
      stub: { journeyModes: ['watch'], hasTemplate: false },
      boot: 'sign-in',
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
      boot: 'sign-in',
      expectText: [/barrier|day \d+|good (morning|afternoon|evening)|photo/i],
    },
  ];

  try {
    for (const c of cases) {
      console.log('Running', c.id);
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

  fs.writeFileSync(ISSUES_PATH, JSON.stringify(issues, null, 2));
  console.log('Wrote', ISSUES_PATH);

  // Refresh JOURNEYS / UX_DEBUG notes for C/P
  const blankFixNote = `
## Cold-start / post-auth recapture (2026-07-14)

Bare \`/app\` static export paints a **blank white shell** in Chromium (no Expo hydrate). C1–C5 and P1–P7 were re-captured via \`/app/index\` (no session) or \`/app/sign-in\` session auto-redirect (exercises \`resolvePostAuthRoute\` after \`/me\`). See \`rerun-cp-issues.json\`.
`;
  const uxPath = path.join(OUT, 'UX_DEBUG.md');
  let ux = fs.readFileSync(uxPath, 'utf8');
  if (!ux.includes('Cold-start / post-auth recapture')) {
    ux += blankFixNote;
    // Downgrade spurious blank-/app URL issues in table isn't automated; append clarification
    fs.writeFileSync(uxPath, ux);
  }

  const jPath = path.join(OUT, 'JOURNEYS.md');
  let j = fs.readFileSync(jPath, 'utf8');
  if (!j.includes('recapture note')) {
    j = j.replace(
      'Diagnostic walkthrough',
      'Diagnostic walkthrough *(C/P matrices: recapture note — boot via `/app/index` or session `/app/sign-in` redirect; bare `/app` is blank on static export)*',
    );
    fs.writeFileSync(jPath, j);
  }

  console.log(issues.map((i) => `${i.id}: ${i.severity} ${i.issue} ${i.url || ''}`).join('\n'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
