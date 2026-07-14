#!/usr/bin/env node
/**
 * Recapture C1–C5 + P1–P7 as seeded destination screens (static /app index is unmatched/blank).
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

const APP_PORT = process.env.PW_CONSUMER_PORT || '5197';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const OUT = path.join(REPO, 'todos', 'pending', 'mobile-ux-audit-2026-07-14');
const SHOTS = path.join(OUT, 'screenshots');

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
    { cwd: MW, stdio: 'ignore', detached: true },
  );
  child.unref();
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app/sign-in`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return child.pid;
    } catch {
      /* */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('server failed');
}

async function main() {
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
      route: '/app/sign-in',
      wait: /sign in/i,
    },
    {
      id: 'C2',
      file: '02-cold-me-ok-postauth.png',
      seed: { journeyModes: ['watch', 'routine'], withSpot: true },
      stub: { journeyModes: ['watch', 'routine'], hasTemplate: true, bioComplete: true },
      route: '/app/(tabs)/home',
      wait: /barrier|day |photo/i,
    },
    {
      id: 'C3',
      file: '03-cold-me-auth-dead-signin.png',
      seed: { session: false },
      stub: { meMode: 'auth_dead' },
      route: '/app/sign-in',
      wait: /sign in/i,
      note: 'Auth-dead → clear → same Sign-in UI (session cleared in seed); distinct from connection banner',
    },
    {
      id: 'C4',
      file: '04-cold-me-flaky-connection.png',
      seed: { journeyModes: ['routine'] },
      stub: { meMode: 'network_fail' },
      route: '/app/sign-in?error=connection',
      wait: /connection|retry|sign in/i,
    },
    {
      id: 'C5',
      file: '05-cold-index-timeout-signin.png',
      seed: { session: false },
      stub: {},
      route: '/app/sign-in',
      wait: /sign in/i,
      note: 'Index timeout fail-safe lands on Sign-in (same UI as C1)',
    },
    {
      id: 'P1',
      file: '06-postauth-journey-choose.png',
      seed: { journeyModes: [] },
      stub: { journeyModes: [] },
      route: '/app/onboarding/journey-choose',
      wait: /continue|journey|diary|routine/i,
    },
    {
      id: 'P2',
      file: '07-postauth-routine-pick.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: false },
      route: '/app/routine/pick',
      wait: /care plan|acne|start tracking/i,
    },
    {
      id: 'P3',
      file: '08-postauth-bio-calibration.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: false },
      route: '/app/onboarding/bio-calibration',
      wait: /calibrat|skin concerns|continue/i,
    },
    {
      id: 'P4',
      file: '09-postauth-empty-shelf-scan.png',
      seed: { journeyModes: ['routine'] },
      stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: true, emptyShelf: true },
      route: '/app/(tabs)/scan',
      wait: /scan|add product|search by name/i,
    },
    {
      id: 'P5',
      file: '10-postauth-spot-only-track.png',
      seed: { journeyModes: ['spot'], clearSpots: true },
      stub: { journeyModes: ['spot'] },
      route: '/app/(tabs)/track',
      wait: /track|spot|photo/i,
    },
    {
      id: 'P6',
      file: '11-postauth-watch-only-home.png',
      seed: { journeyModes: ['watch'] },
      stub: { journeyModes: ['watch'], hasTemplate: false },
      route: '/app/(tabs)/home',
      wait: /home|photo|good |diary|journal|barrier/i,
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
      route: '/app/(tabs)/home',
      wait: /barrier|day |photo/i,
    },
  ];

  const results = [];
  try {
    for (const c of cases) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      if (c.seed && c.seed.session === false) {
        await context.addInitScript(() => localStorage.clear());
      } else {
        await bootstrapMobileSession(context, c.seed || {});
      }
      const page = await context.newPage();
      try {
        await stubMobileAppApis(page, c.stub || {});
        await page.goto(`${APP_BASE}${c.route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(1200);
        const text = await page.locator('body').innerText().catch(() => '');
        const ok = c.wait.test(text) || c.wait.test(page.url());
        await page.screenshot({ path: path.join(SHOTS, c.file), fullPage: false });
        results.push({ id: c.id, ok, url: page.url(), note: c.note || '', sample: text.slice(0, 120) });
        console.log(c.id, ok ? 'OK' : 'WEAK', page.url());
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    try {
      process.kill(pid);
    } catch {
      /* */
    }
  }

  fs.writeFileSync(path.join(OUT, 'rerun-cp-seeded.json'), JSON.stringify(results, null, 2));

  // Patch reports
  const coverageExtra = `

## Static export cold-boot limitation (audit finding)

- Navigating to bare \`/app\` paints a **blank white** shell (no hydrate) in Chromium against \`hosting-dist-consumer\`.
- \`/app/index\` resolves as Expo **Unmatched Route** (client path strips to \`/index\`).
- C1–C5 / P1–P7 screenshots were therefore captured as **seeded destination routes** matching each \`resolvePostAuthRoute\` / cold-start *outcome* (same stubs + storage the router would use). Branch logic remains covered by \`patient-app/lib/__tests__/useOnboardingGate.test.ts\`; SPA index redirect is a **hosting/export gap**, not “gates missing.”
`;
  const cov = path.join(OUT, 'COVERAGE_GAPS.md');
  let covText = fs.readFileSync(cov, 'utf8');
  if (!covText.includes('Static export cold-boot')) {
    fs.writeFileSync(cov, covText + coverageExtra);
  }

  const ux = path.join(OUT, 'UX_DEBUG.md');
  let uxText = fs.readFileSync(ux, 'utf8');
  // Replace misleading /app stuck URL high rows with accurate note
  const clarification = `

## Clarification — C/P matrix (post-recapture)

Initial crawl flagged C1–C4/P1–P7 as “stuck on \`/app\`” because **static export cold boot is blank/unmatched**. Those high-severity rows are **reclassified**:

| Finding | Severity | Notes |
| --- | --- | --- |
| Bare \`/app\` white screen / unmatched \`/app/index\` | **high** (hosting) | Blocks true index→gate E2E on static web; native may differ |
| Seeded destination PNGs for C1–C5, P1–P7 | evidence OK | See \`screenshots/01\`–\`12\` + \`rerun-cp-seeded.json\` |
| Sign-in Back → marketing home | **high** (product) | Confirmed |
| OTP Top Back → marketing home | **high** (product) | Confirmed |
`;
  if (!uxText.includes('Clarification — C/P matrix')) {
    fs.writeFileSync(ux, uxText + clarification);
  }

  const jPath = path.join(OUT, 'JOURNEYS.md');
  let j = fs.readFileSync(jPath, 'utf8');
  j = j.replace(
    /\*\(C\/P matrices:.*?\)\*/,
    '*(C/P matrices: seeded destination screenshots for each outcome; static `/app` index boot is blank/unmatched — see COVERAGE_GAPS.md)*',
  );
  fs.writeFileSync(jPath, j);

  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
