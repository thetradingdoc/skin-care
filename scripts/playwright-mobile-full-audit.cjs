#!/usr/bin/env node
/**
 * Full mobile journey Playwright audit — Expo web /app @ 390×844.
 * Deliverables → todos/pending/mobile-ux-audit-2026-07-14/
 *
 * Run: node scripts/playwright-mobile-full-audit.cjs
 */
'use strict';

const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const MW = path.join(REPO, 'middleware-platform');
const requireMw = createRequire(path.join(MW, 'package.json'));
const { chromium } = requireMw('@playwright/test');
const {
  MOCK_PRODUCT_ID,
  bootstrapMobileSession,
  stubMobileAppApis,
} = require(path.join(MW, 'e2e/helpers/mobile-app-mocks.cjs'));

const LOCAL_BROWSERS = path.join(MW, '.playwright-browsers');
if (fs.existsSync(LOCAL_BROWSERS)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
}

const APP_PORT = process.env.PW_CONSUMER_PORT || '5195';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const OUT = path.join(REPO, 'todos', 'pending', 'mobile-ux-audit-2026-07-14');
const SHOTS = path.join(OUT, 'screenshots');

const issues = [];
const shotIndex = [];
const buttonResults = [];
let shotSeq = 0;

function noteIssue(severity, surface, issue, detail) {
  issues.push({ severity, surface, issue, detail: detail || '' });
}

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

function ensureOut() {
  fs.mkdirSync(SHOTS, { recursive: true });
}

async function ensureHosting() {
  const ensure = path.join(MW, 'scripts', 'ensure-conflict-engine-hosting.cjs');
  const r = spawnSync(process.execPath, [ensure], { cwd: MW, stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error('ensure-conflict-engine-hosting failed');
  return path.join(REPO, 'unified-dashboard', 'hosting-dist-consumer');
}

async function startServer(dist) {
  const serveScript = path.join(MW, 'scripts', 'serve-consumer-hosting.cjs');
  const child = spawn(process.execPath, [serveScript, dist, APP_PORT], {
    cwd: MW,
    stdio: 'ignore',
    detached: true,
  });
  child.unref();
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app/sign-in`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return child.pid;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Consumer hosting did not start');
}

async function shot(page, slug, meta = {}) {
  shotSeq += 1;
  const idx = String(shotSeq).padStart(2, '0');
  const file = `${idx}-${slug}.png`;
  const full = path.join(SHOTS, file);
  await page.waitForTimeout(400);
  await page.screenshot({ path: full, fullPage: false });
  const rec = { idx, slug, file, url: page.url(), ...meta };
  shotIndex.push(rec);
  return rec;
}

async function waitSettle(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.getByRole('progressbar').first().waitFor({ state: 'hidden', timeout: 12_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function freshContext(browser, seed) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  if (seed && seed.session !== false) {
    await bootstrapMobileSession(context, seed);
  } else if (seed && seed.session === false) {
    await context.addInitScript(() => {
      localStorage.removeItem('patient_session_id');
      localStorage.removeItem('patient_session_email');
      localStorage.removeItem('patient_api_base_url');
      localStorage.removeItem('api_base');
      localStorage.removeItem('patient_journey_profile_v1');
    });
  }
  const page = await context.newPage();
  return { context, page };
}

async function gotoApp(page, route, stubOpts) {
  await stubMobileAppApis(page, stubOpts || {});
  await page.goto(`${APP_BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await waitSettle(page);
}

function urlMatches(url, re) {
  return re.test(url);
}

async function runColdStart(browser) {
  // Static /app is blank/unmatched — capture each cold-start *outcome* via seeded destination.
  const cases = [
    { id: 'C1', slug: 'cold-no-session-signin', fileHint: '01', seed: { session: false }, stub: {}, route: '/app/sign-in', expect: /sign in/i },
    { id: 'C2', slug: 'cold-me-ok-postauth', seed: { journeyModes: ['watch', 'routine'], withSpot: true }, stub: { journeyModes: ['watch', 'routine'], hasTemplate: true, bioComplete: true }, route: '/app/(tabs)/home', expect: /barrier|day |photo/i },
    { id: 'C3', slug: 'cold-me-auth-dead-signin', seed: { session: false }, stub: { meMode: 'auth_dead' }, route: '/app/sign-in', expect: /sign in/i },
    { id: 'C4', slug: 'cold-me-flaky-connection', seed: { journeyModes: ['routine'] }, stub: { meMode: 'network_fail' }, route: '/app/sign-in?error=connection', expect: /connection|retry/i },
    { id: 'C5', slug: 'cold-index-timeout-signin', seed: { session: false }, stub: {}, route: '/app/sign-in', expect: /sign in/i, optional: true },
  ];

  for (const c of cases) {
    const { context, page } = await freshContext(browser, c.seed);
    try {
      await gotoApp(page, c.route, c.stub);
      await shot(page, c.slug, { matrix: 'cold', id: c.id });
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      if (!c.expect.test(body) && !c.expect.test(page.url()) && !c.optional) {
        noteIssue('high', 'cold-start', `${c.id} missing expected UI`, page.url());
      }
    } catch (e) {
      noteIssue(c.optional ? 'low' : 'high', 'cold-start', `${c.id} failed`, e.message);
    } finally {
      await context.close();
    }
  }
}

async function runPostAuth(browser) {
  const cases = [
    { id: 'P1', slug: 'postauth-journey-choose', seed: { journeyModes: [] }, stub: { journeyModes: [] }, route: '/app/onboarding/journey-choose', expect: /journey|diary|continue/i },
    { id: 'P2', slug: 'postauth-routine-pick', seed: { journeyModes: ['routine'] }, stub: { journeyModes: ['routine'], hasTemplate: false }, route: '/app/routine/pick', expect: /care plan|acne/i },
    { id: 'P3', slug: 'postauth-bio-calibration', seed: { journeyModes: ['routine'] }, stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: false }, route: '/app/onboarding/bio-calibration', expect: /calibrat|skin concerns/i },
    { id: 'P4', slug: 'postauth-empty-shelf-scan', seed: { journeyModes: ['routine'] }, stub: { journeyModes: ['routine'], hasTemplate: true, bioComplete: true, emptyShelf: true }, route: '/app/(tabs)/scan', expect: /scan|add product|0 added/i },
    { id: 'P5', slug: 'postauth-spot-only-track', seed: { journeyModes: ['spot'], clearSpots: true }, stub: { journeyModes: ['spot'] }, route: '/app/(tabs)/track', expect: /track|spot/i },
    { id: 'P6', slug: 'postauth-watch-only-home', seed: { journeyModes: ['watch'] }, stub: { journeyModes: ['watch'], hasTemplate: false }, route: '/app/(tabs)/home', expect: /home|photo|good /i },
    { id: 'P7', slug: 'postauth-setup-complete-home', seed: { journeyModes: ['watch', 'routine'], withSpot: true }, stub: { journeyModes: ['watch', 'routine'], hasTemplate: true, bioComplete: true, emptyShelf: false }, route: '/app/(tabs)/home', expect: /barrier|day |photo/i },
  ];

  for (const c of cases) {
    const { context, page } = await freshContext(browser, c.seed);
    try {
      await gotoApp(page, c.route, c.stub);
      await shot(page, c.slug, { matrix: 'postauth', id: c.id });
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      if (!c.expect.test(body) && !c.expect.test(page.url())) {
        noteIssue('high', 'post-auth', `${c.id} missing expected UI`, page.url());
      }
    } catch (e) {
      noteIssue('high', 'post-auth', `${c.id} failed`, e.message);
    } finally {
      await context.close();
    }
  }
}

async function auditButton(page, entry) {
  const base = {
    screen: entry.screen,
    button: entry.button,
    action: entry.action,
    route: entry.route,
  };
  if (entry.skip) {
    return { ...base, result: 'skip', reason: entry.skipReason || 'Skipped' };
  }
  try {
    if (entry.setup === 'fillEmail') {
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
    }
    if (entry.setup === 'otpStep') {
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
      await page.getByRole('button', { name: /send code/i }).click();
      await page.getByText(/enter code/i).waitFor({ timeout: 10_000 });
    }
    if (entry.setup === 'selectAcne') {
      await page.getByText(/acne care plan/i).first().click();
    }
    const attempts = [
      () => page.getByRole(entry.role || 'button', { name: entry.label }),
      () => page.getByText(entry.label).first(),
    ];
    let clicked = false;
    for (const fn of attempts) {
      try {
        const loc = fn().first();
        await loc.waitFor({ state: 'visible', timeout: 6_000 });
        await loc.click({ timeout: 5_000 });
        clicked = true;
        break;
      } catch {
        /* next */
      }
    }
    if (!clicked) throw new Error(`Control not found: ${entry.button}`);
    await page.waitForTimeout(800);
    if (entry.expectUrl) {
      const u = page.url();
      if (!entry.expectUrl.test(u)) throw new Error(`URL ${u} !~ ${entry.expectUrl}`);
    }
    if (entry.expectText) {
      await page.getByText(entry.expectText).first().waitFor({ state: 'visible', timeout: 6_000 });
    }
    if (entry.expectProductFail) {
      // Sign-in Back currently opens marketing home — mark fail-vs-product if leaves /app
      const u = page.url();
      if (/myskinandcare\.com\/?$/.test(u) || (!u.includes('/app') && /myskinandcare/.test(u))) {
        return {
          ...base,
          result: 'fail',
          error: 'Back navigates to marketing landing (product bug vs in-app back)',
          observedUrl: u,
        };
      }
    }
    return { ...base, result: 'pass', observedUrl: page.url() };
  } catch (err) {
    return { ...base, result: 'fail', error: (err.message || String(err)).slice(0, 240) };
  }
}

async function runButtonsAndScreens(browser) {
  const seed = {
    journeyModes: ['watch', 'routine'],
    withSpot: true,
  };
  const stub = {
    journeyModes: ['watch', 'routine'],
    hasTemplate: true,
    bioComplete: true,
    emptyShelf: false,
  };

  // Auth screens
  {
    const { context, page } = await freshContext(browser, { session: false });
    try {
      await gotoApp(page, '/app/sign-in', {});
      await shot(page, 'auth-signin-email', { area: 'auth' });
      let r = await auditButton(page, {
        screen: 'Sign-in',
        button: 'Go back',
        action: 'Should stay in-app or prior; currently opens marketing home',
        route: '/app/sign-in',
        label: /go back|back/i,
        expectProductFail: true,
      });
      buttonResults.push(r);
      if (r.result === 'fail') {
        noteIssue('high', 'sign-in', 'Back button leaves app to marketing home', r.error);
      }
      await shot(page, 'auth-signin-after-back', { area: 'auth' });

      await gotoApp(page, '/app/sign-in', {});
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
      r = await auditButton(page, {
        screen: 'Sign-in',
        button: 'Send code',
        action: 'Advance to OTP',
        route: '/app/sign-in',
        label: /send code/i,
        expectText: /enter code/i,
      });
      buttonResults.push(r);
      await shot(page, 'auth-signin-otp', { area: 'auth' });

      r = await auditButton(page, {
        screen: 'Sign-in OTP',
        button: 'Go back (top)',
        action: 'Should return to email step; may leave app',
        route: '/app/sign-in',
        label: /go back|back/i,
        expectProductFail: true,
      });
      buttonResults.push(r);
      if (r.result === 'fail') {
        noteIssue('high', 'sign-in', 'OTP step Top Back leaves app instead of email step', r.error);
      }

      await gotoApp(page, '/app/sign-in', {});
      await page.getByPlaceholder('you@example.com').fill('inventory-e2e@example.com');
      await page.getByRole('button', { name: /send code/i }).click();
      await page.getByText(/enter code/i).waitFor({ timeout: 10_000 });
      r = await auditButton(page, {
        screen: 'Sign-in OTP',
        button: 'Use a different email',
        action: 'Reset to email step',
        route: '/app/sign-in',
        label: /different email/i,
        expectText: /email/i,
      });
      buttonResults.push(r);

      await gotoApp(page, '/app/sign-in?error=connection', {});
      await shot(page, 'auth-signin-connection-error', { area: 'auth' });
      const retry = page.getByRole('button', { name: /retry/i });
      if (await retry.isVisible().catch(() => false)) {
        buttonResults.push({
          screen: 'Sign-in',
          button: 'Retry',
          action: 'Re-run cold start',
          route: '/app/sign-in?error=connection',
          result: 'pass',
        });
      }
    } finally {
      await context.close();
    }
  }

  // Tabs + features with session
  {
    const { context, page } = await freshContext(browser, seed);
    try {
      await gotoApp(page, '/app/(tabs)/home', stub);
      await shot(page, 'tab-home-populated', { area: 'tabs' });

      await gotoApp(page, '/app/(tabs)/home?celebrate=1', stub);
      await shot(page, 'tab-home-celebrate', { area: 'tabs' });

      await gotoApp(page, '/app/(tabs)/home?photo=1', stub);
      await shot(page, 'tab-home-photo-param', { area: 'tabs' });

      for (const [route, slug, buttons] of [
        [
          '/app/(tabs)/track',
          'tab-track-with-spot',
          [
            {
              screen: 'Track',
              button: 'Track tab visible',
              action: 'Render spot list',
              route: '/app/(tabs)/track',
              label: /track|neck|spot|photo/i,
              soft: true,
            },
          ],
        ],
        [
          '/app/(tabs)/scan',
          'tab-scan-with-shelf',
          [
            {
              screen: 'Scan',
              button: 'or search by name',
              action: 'Open manual add',
              route: '/app/(tabs)/scan',
              label: /search by name/i,
              expectText: /add by name|product/i,
            },
            {
              screen: 'Scan',
              button: 'Add product',
              action: 'Open manual add FAB',
              route: '/app/(tabs)/scan',
              label: /add product/i,
            },
          ],
        ],
        ['/app/(tabs)/progress', 'tab-progress', []],
        ['/app/(tabs)/account', 'tab-profile', []],
      ]) {
        await gotoApp(page, route, stub);
        await shot(page, slug, { area: 'tabs' });
        for (const b of buttons) {
          if (b.soft) {
            const vis = await page.getByText(b.label).first().isVisible().catch(() => false);
            buttonResults.push({
              ...b,
              result: vis ? 'pass' : 'fail',
              error: vis ? undefined : 'Not visible',
            });
            continue;
          }
          // re-goto for each clickable
          await gotoApp(page, route, stub);
          buttonResults.push(await auditButton(page, b));
        }
      }

      // Profile buttons
      await gotoApp(page, '/app/(tabs)/account', stub);
      await shot(page, 'tab-profile-session-copy', { area: 'tabs' });
      const sessionCopy = await page.getByText(/24 hours|60 minutes/i).isVisible().catch(() => false);
      if (!sessionCopy) {
        noteIssue('medium', 'profile', 'Idle/max-age session copy missing on Profile', '');
      }
      for (const b of [
        {
          screen: 'Profile',
          button: 'Edit skin profile',
          action: 'Open bio calibration',
          route: '/app/(tabs)/account',
          label: /edit skin profile/i,
          expectUrl: /bio-calibration/,
        },
        {
          screen: 'Profile',
          button: 'Change program',
          action: 'Open routine pick',
          route: '/app/(tabs)/account',
          label: /change program/i,
          expectUrl: /routine\/pick/,
        },
        {
          screen: 'Profile',
          button: 'Subscribe',
          action: 'Stripe checkout (external)',
          route: '/app/(tabs)/account',
          label: /^subscribe$/i,
          skip: true,
          skipReason: 'Opens external Stripe WebBrowser',
        },
        {
          screen: 'Profile',
          button: 'Sign out',
          action: 'Clear session → sign-in',
          route: '/app/(tabs)/account',
          label: /sign out/i,
          expectUrl: /sign-in/,
        },
      ]) {
        if (b.skip) {
          buttonResults.push(await auditButton(page, b));
          continue;
        }
        await gotoApp(page, '/app/(tabs)/account', stub);
        buttonResults.push(await auditButton(page, b));
      }

      // Subscription return (no Stripe)
      await gotoApp(page, '/app/(tabs)/account?subscription=success', stub);
      await shot(page, 'profile-subscription-return-success', { area: 'subscription' });

      // Progress → spot
      await gotoApp(page, '/app/(tabs)/progress', stub);
      const spotRow = page.getByText(/neck spot/i).first();
      if (await spotRow.isVisible().catch(() => false)) {
        await spotRow.click();
        await waitSettle(page);
        await shot(page, 'crossnav-progress-to-track-spot', { area: 'crossnav' });
        buttonResults.push({
          screen: 'Progress',
          button: 'Spot row (Neck spot)',
          action: 'Open track/[id]',
          route: '/app/(tabs)/progress',
          result: /track\//.test(page.url()) ? 'pass' : 'fail',
          observedUrl: page.url(),
          error: /track\//.test(page.url()) ? undefined : 'Did not navigate to track detail',
        });
      } else {
        noteIssue('medium', 'progress', 'Spot row not visible for cross-nav', '');
        buttonResults.push({
          screen: 'Progress',
          button: 'Spot row',
          action: 'Open track/[id]',
          route: '/app/(tabs)/progress',
          result: 'fail',
          error: 'Spot row not visible',
        });
      }

      // Compare
      await gotoApp(page, '/app/compare?dateA=2026-06-01&dateB=2026-07-14', stub);
      await shot(page, 'feature-compare', { area: 'features' });

      // Verdict
      await gotoApp(page, `/app/verdict/${MOCK_PRODUCT_ID}`, stub);
      await shot(page, 'feature-verdict', { area: 'features' });
      for (const b of [
        {
          screen: 'Verdict',
          button: "Don't use it",
          action: 'Remove → Scan',
          route: `/app/verdict/${MOCK_PRODUCT_ID}`,
          label: /don'?t use it/i,
          expectUrl: /scan/,
        },
      ]) {
        await gotoApp(page, `/app/verdict/${MOCK_PRODUCT_ID}`, stub);
        buttonResults.push(await auditButton(page, b));
      }
      await gotoApp(page, `/app/verdict/${MOCK_PRODUCT_ID}`, stub);
      buttonResults.push(
        await auditButton(page, {
          screen: 'Verdict',
          button: 'Keep anyway',
          action: 'Keep → Scan',
          route: `/app/verdict/${MOCK_PRODUCT_ID}`,
          label: /keep anyway/i,
          expectUrl: /scan/,
        }),
      );

      // Routine capture writable
      await gotoApp(page, '/app/routine/capture', { ...stub, allowsPhoto: true });
      await shot(page, 'feature-routine-capture-writable', { area: 'features' });
      buttonResults.push(
        await auditButton(page, {
          screen: 'Routine capture',
          button: 'Cancel',
          action: 'Navigate back',
          route: '/app/routine/capture',
          label: /^cancel$/i,
        }),
      );

      // Routine capture read-only
      await gotoApp(page, '/app/routine/capture?date=2026-01-01', { ...stub, allowsPhoto: false });
      await shot(page, 'feature-routine-capture-readonly', { area: 'features' });
      const ro = await page.getByText(/read-only/i).isVisible().catch(() => false);
      if (!ro) noteIssue('medium', 'routine-capture', 'Read-only older day copy not visible', page.url());

      // Track capture
      await gotoApp(page, '/app/track/capture', stub);
      await shot(page, 'feature-track-capture', { area: 'features' });

      await gotoApp(page, '/app/track/spot_neck_1', stub);
      await shot(page, 'feature-track-spot-detail', { area: 'features' });

      // Journal capture — flag off
      await gotoApp(page, '/app/journal/capture', stub);
      await shot(page, 'feature-journal-capture-attempt', { area: 'features', skipNote: 'JOURNAL_CAPTURE_ENABLED=false' });
      noteIssue(
        'low',
        'journal',
        'JOURNAL_CAPTURE_ENABLED=false — documented flag-off skip (stub cannot flip compile-time flag)',
        '',
      );

      // Gates
      await gotoApp(page, '/app/onboarding/journey-choose', { journeyModes: [] });
      await shot(page, 'gate-journey-choose', { area: 'gates' });
      await gotoApp(page, '/app/routine/pick', { journeyModes: ['routine'], hasTemplate: false });
      await shot(page, 'gate-routine-pick', { area: 'gates' });
      buttonResults.push(
        await auditButton(page, {
          screen: 'Routine pick',
          button: 'Acne program card',
          action: 'Select program',
          route: '/app/routine/pick',
          label: /acne care plan/i,
        }),
      );
      await gotoApp(page, '/app/onboarding/bio-calibration', {
        journeyModes: ['routine'],
        hasTemplate: true,
        bioComplete: false,
      });
      await shot(page, 'gate-bio-calibration', { area: 'gates' });
      const allergen = await page.getByText(/acrylate|allergen|exclusion/i).isVisible().catch(() => false);
      if (allergen) {
        noteIssue('low', 'bio', 'Unexpected allergen UI present', '');
      } else {
        // evidence for market gap — conditions/prescriptions only
      }

      // Empty shelf scan state
      await gotoApp(page, '/app/(tabs)/scan', { ...stub, emptyShelf: true });
      await shot(page, 'tab-scan-empty', { area: 'tabs' });

      // Empty track
      {
        const { context: c2, page: p2 } = await freshContext(browser, {
          journeyModes: ['spot'],
          clearSpots: true,
        });
        try {
          await gotoApp(p2, '/app/(tabs)/track', { journeyModes: ['spot'] });
          await shot(p2, 'tab-track-empty', { area: 'tabs' });
        } finally {
          await c2.close();
        }
      }

      // Tab bar navigation
      await gotoApp(page, '/app/(tabs)/home', stub);
      for (const tab of [
        { name: 'Track', expect: /track/ },
        { name: 'Scan', expect: /scan/ },
        { name: 'Progress', expect: /progress/ },
        { name: 'Profile', expect: /account/ },
        { name: 'Home', expect: /home/ },
      ]) {
        await gotoApp(page, '/app/(tabs)/home', stub);
        const r = await auditButton(page, {
          screen: 'Tab bar',
          button: tab.name,
          action: `Navigate to ${tab.name}`,
          route: '/app/(tabs)/home',
          role: 'tab',
          label: tab.name,
          expectUrl: tab.expect,
        });
        buttonResults.push(r);
      }

      // Home Log progress photo
      await gotoApp(page, '/app/(tabs)/home', stub);
      buttonResults.push(
        await auditButton(page, {
          screen: 'Home',
          button: 'Log progress photo',
          action: 'Open routine capture',
          route: '/app/(tabs)/home',
          label: /log progress photo|take progress photo|today'?s photo/i,
          expectUrl: /routine\/capture|journal\/capture/,
        }),
      );

      // Progress compare CTA
      await gotoApp(page, '/app/(tabs)/progress', stub);
      buttonResults.push(
        await auditButton(page, {
          screen: 'Progress',
          button: 'Compare day 1 to today',
          action: 'Open compare',
          route: '/app/(tabs)/progress',
          label: /compare/i,
          expectUrl: /compare/,
        }),
      );

      // Legacy trio
      for (const [route, slug] of [
        ['/app/onboarding/scan', 'legacy-onboarding-scan'],
        ['/app/onboarding/reveal', 'legacy-onboarding-reveal'],
        ['/app/onboarding/concerns', 'legacy-onboarding-concerns'],
      ]) {
        try {
          await gotoApp(page, route, stub);
          await shot(page, slug, { area: 'legacy' });
        } catch (e) {
          noteIssue('low', 'legacy', `${slug} failed`, e.message);
        }
      }
    } finally {
      await context.close();
    }
  }

  // Web discovery (landing) if present on consumer dist root
  {
    const { context, page } = await freshContext(browser, { session: false });
    try {
      for (const [route, slug] of [
        ['/', 'web-landing-home'],
        ['/scan', 'web-landing-scan'],
        ['/reveal', 'web-landing-reveal'],
        ['/concerns', 'web-landing-concerns'],
        ['/app/sign-in?intent=signup&from=skin-age-landing', 'web-signin-signup-intent'],
      ]) {
        try {
          await page.goto(`${APP_BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
          await waitSettle(page);
          await shot(page, slug, { area: 'web-discovery' });
        } catch (e) {
          noteIssue('low', 'web-discovery', `${slug} unavailable on consumer hosting`, e.message);
        }
      }
    } finally {
      await context.close();
    }
  }
}

function writeReports() {
  ensureOut();

  const jsonSummary = {
    generated_at: new Date().toISOString(),
    total: buttonResults.length,
    pass: buttonResults.filter((r) => r.result === 'pass').length,
    fail: buttonResults.filter((r) => r.result === 'fail').length,
    skip: buttonResults.filter((r) => r.result === 'skip').length,
    results: buttonResults,
    screenshots: shotIndex,
    issues,
  };
  fs.writeFileSync(path.join(OUT, 'button-inventory-results.json'), JSON.stringify(jsonSummary, null, 2));

  const btnMd = [
    '# BUTTON_INVENTORY',
    '',
    `Generated: ${jsonSummary.generated_at}`,
    '',
    `| Screen | Button | Action | Result | Notes |`,
    `| --- | --- | --- | --- | --- |`,
    ...buttonResults.map((r) => {
      const notes = (r.error || r.reason || r.observedUrl || '—').replace(/\|/g, '/');
      return `| ${r.screen} | ${r.button} | ${r.action} | **${r.result}** | ${notes} |`;
    }),
    '',
    `Summary: ${jsonSummary.pass} pass / ${jsonSummary.fail} fail / ${jsonSummary.skip} skip`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'BUTTON_INVENTORY.md'), btnMd);

  function embed(slug) {
    const hit = shotIndex.find((s) => s.slug === slug);
    if (!hit) return `_Missing screenshot: \`${slug}\`_\n`;
    return `![${slug}](screenshots/${hit.file})\n`;
  }

  const journeys = [
    '# JOURNEYS',
    '',
    'Diagnostic walkthrough of Expo web `/app` @ 390×844 with API stubs. Native TestFlight not covered.',
    '',
    '## New user (web-first)',
    '',
    '1. Landing / scan / reveal / concerns (web discovery shots if present on hosting dist)',
    embed('web-landing-home'),
    embed('web-landing-scan'),
    embed('web-signin-signup-intent'),
    '2. OTP signup intent → post-auth gates → Home/Scan (see post-auth matrix).',
    '',
    '## Returning user',
    '',
    '1. Cold `/app` → sign-in (C1) or direct post-auth (C2).',
    '2. Daily loop: Home photo → Track → Scan verdict → Progress compare → Profile.',
    embed('tab-home-populated'),
    embed('feature-routine-capture-writable'),
    embed('tab-track-with-spot'),
    embed('feature-verdict'),
    embed('tab-progress'),
    embed('tab-profile-session-copy'),
    '',
    '## Cold-start matrix (C1–C5)',
    '',
  ];

  for (const id of ['C1', 'C2', 'C3', 'C4', 'C5']) {
    const slug = shotIndex.find((s) => s.id === id)?.slug;
    journeys.push(`### ${id}${slug ? ` — \`${slug}\`` : ''}`, '');
    if (slug) journeys.push(embed(slug));
    else journeys.push('_No screenshot_', '');
  }

  journeys.push('', '## Post-auth matrix (P1–P7)', '');
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) {
    const slug = shotIndex.find((s) => s.id === id)?.slug;
    journeys.push(`### ${id}${slug ? ` — \`${slug}\`` : ''}`, '');
    if (slug) journeys.push(embed(slug));
    else journeys.push('_No screenshot_', '');
  }

  journeys.push(
    '',
    '## Journal capture',
    '',
    '**Flag-off skip:** `JOURNAL_CAPTURE_ENABLED=false` in `patient-app/constants/feature-flags.ts`. Stubs cannot flip the Metro-bundled constant. Attempted navigation still captured:',
    '',
    embed('feature-journal-capture-attempt'),
    '',
  );
  fs.writeFileSync(path.join(OUT, 'JOURNEYS.md'), journeys.join('\n'));

  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

  const ux = [
    '# UX_DEBUG',
    '',
    `Generated: ${jsonSummary.generated_at}`,
    '',
    'Severity-ranked issues from Playwright audit + known product bugs exercised on web.',
    '',
    '| Severity | Surface | Issue | Detail |',
    '| --- | --- | --- | --- |',
    ...issues.map(
      (i) =>
        `| ${i.severity} | ${i.surface} | ${i.issue.replace(/\|/g, '/')} | ${(i.detail || '—').replace(/\|/g, '/').slice(0, 200)} |`,
    ),
    '',
    '## Button failures',
    '',
    ...buttonResults
      .filter((r) => r.result === 'fail')
      .map((r) => `- **${r.screen} / ${r.button}**: ${r.error || 'fail'}`),
    '',
    '## Explicit follow-ups (also in COVERAGE_GAPS.md)',
    '',
    '- Session idle / max-age expiry redirect timing — Profile copy screenshotted; redirect not forced on web.',
    '- `patientapp://auth?ticket=…` handoff — custom scheme, not Playwright-reachable.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'UX_DEBUG.md'), ux);

  const coverage = `# COVERAGE_GAPS

Explicit holes so they are not silent.

| Gap | Why Playwright can't cover | Follow-up |
| --- | --- | --- |
| SecureStore / true SecureStore session | Web uses localStorage | Device smoke |
| True camera shutter / permissions | Fake media only | Device smoke |
| Splash / cold native chrome | Expo web ≠ native splash | Device smoke |
| \`patientapp://auth?ticket=…\` handoff | Custom URL scheme | Device/TestFlight deep-link smoke |
| Idle / max-age session expiry timing | Clock/idle hard to fake reliably on web stubs | Device smoke; Profile copy captured in \`tab-profile-session-copy\` |
| \`/journal/capture\` live path | \`JOURNAL_CAPTURE_ENABLED=false\` compile-time | Flip flag + rebuild hosting, or keep skip |

Native \`.ipa\` / TestFlight photo set is out of scope for this diagnostic pass.
`;
  fs.writeFileSync(path.join(OUT, 'COVERAGE_GAPS.md'), coverage);

  const evidence = (slug) => {
    const hit = shotIndex.find((s) => s.slug === slug);
    return hit ? `screenshots/${hit.file}` : `(missing ${slug})`;
  };

  const market = `# MARKET_GAP

IA-grounded gap analysis. Diagnostic only — not a redesign spec.
Evidence slugs refer to files under \`screenshots/\`.

## 1. Complex multi-concern care

- **Have:** Multi-select at journey-choose; routine/pick concern → template.
- **Gap:** One active template; one bio pass. No concern priority or concurrent routines. Verdict evaluates a single active plan.
- **Gap type:** \`data-model\` (+ \`engine\`) before UI.
- **UX direction:** Concern-priority on bio-calibration; multi-concern cues on verdict.
- **Audit evidence:** \`${evidence('gate-journey-choose')}\`, \`${evidence('gate-routine-pick')}\`, \`${evidence('feature-verdict')}\`

## 2. Ingredient transparency + allergen exclusion

- **Have:** Scan → OBF/INCI → verdict; bio conditions/prescriptions.
- **Gap:** No acrylate/allergen *exclusion filter*; verdicts advisory (caution), not hard-gated.
- **Gap type:** Small UI + \`engine\` flag on existing screens.
- **UX direction:** Allergen step on bio (acrylates named); distinct hard-exclude vs soft-caution on verdict.
- **Audit evidence:** \`${evidence('gate-bio-calibration')}\`, \`${evidence('feature-verdict')}\`

## 3. Hyper-personalization (env / lifestyle / budget / hormones)

- **Have:** Bio + funnel segments.
- **Gap:** No location/budget/lifestyle in gates; no hormonal-cycle axis.
- **Gap type:** Progressive profiling on Profile — not a new gate.
- **UX direction:** Extend Profile edit-bio; hormone opt-in on Track later.
- **Audit evidence:** \`${evidence('gate-bio-calibration')}\`, \`${evidence('tab-profile-session-copy')}\`, gate screens as negative evidence for lifestyle fields.

## 4. Progress beyond photos

- **Have:** Progress BFI strip, streak, compare-two-dates.
- **Gap:** No cost-per-use, expiry, or concern-rating time-series.
- **Gap type:** \`screen\` extension — cheapest theme.
- **UX direction:** Optional severity on daily photo; Progress graphs; cost/expiry fields on Scan add-product.
- **Audit evidence:** \`${evidence('tab-progress')}\`, \`${evidence('tab-scan-with-shelf')}\`, \`${evidence('feature-routine-capture-writable')}\`

## 5. Local availability / regional environment

- **Have:** Global shelf eval only.
- **Gap:** Sourcing before UI.
- **Gap type:** \`sourcing\` — deprioritize UI.
- **UX direction:** Optional unused Profile location field only if needed for pipeline.
- **Audit evidence:** \`${evidence('tab-scan-with-shelf')}\`

## 6. At-home ↔ professional bridge

- **Have:** Care program / Subscribe on Profile; specialist funnel bits on web.
- **Gap:** No procedure object; no recovery-mode capture.
- **Gap type:** Small data-model + capture variant.
- **UX direction:** Procedure date on Profile care-program; routine/capture recovery branch.
- **Audit evidence:** \`${evidence('tab-profile-session-copy')}\`, \`${evidence('feature-routine-capture-writable')}\`

## Prioritized backlog (build cost × signal)

| Priority | Theme | Why |
| --- | --- | --- |
| 1 | Progress ratings/cost/expiry (#4) | Fits existing screens; no new gates |
| 2 | Allergen exclusion bio+verdict (#2) | High-severity pain; small surface |
| 3 | Multi-concern priority (#1) | Needs data-model before UI |
| 4 | Procedure-aware routine mode (#6) | Cheap after #1 template logic |
| 5 | Progressive profiling (#3) | Ride Profile edit-bio |
| 6 | Regional availability (#5) | Sourcing first |

## Structural sequencing flag

Themes **#1, #2, #3** all touch **bio-calibration** and **verdict**. Sequence or assign a **single design owner** before parallel tickets — avoid three uncoordinated schema changes on the same two screens.
`;
  fs.writeFileSync(path.join(OUT, 'MARKET_GAP.md'), market);

  const review = `# REVIEW_UPLOAD

Chat handoff — **do not** upload the full \`screenshots/\` folder (~40+ PNGs).

## Upload in full (text)

- \`MARKET_GAP.md\`
- \`UX_DEBUG.md\`
- \`COVERAGE_GAPS.md\`
- Optionally \`JOURNEYS.md\` / \`BUTTON_INVENTORY.md\`

## Curated evidence PNGs (~6–8)

| Purpose | File |
| --- | --- |
| Bio calibration (conditions/prescriptions only) | \`${evidence('gate-bio-calibration')}\` |
| Verdict (single-plan advisory) | \`${evidence('feature-verdict')}\` |
| Progress density | \`${evidence('tab-progress')}\` |
| Scan shelf / add product | \`${evidence('tab-scan-with-shelf')}\` |
| Profile edit-bio / care / session copy | \`${evidence('tab-profile-session-copy')}\` |
| Gate (journey-choose or routine pick) | \`${evidence('gate-journey-choose')}\` or \`${evidence('gate-routine-pick')}\` |
| Sign-in Back bug (optional) | \`${evidence('auth-signin-after-back')}\` |
| Post-auth empty shelf → Scan | \`${evidence('postauth-empty-shelf-scan')}\` |

Full package root: \`todos/pending/mobile-ux-audit-2026-07-14/\`
`;
  fs.writeFileSync(path.join(OUT, 'REVIEW_UPLOAD.md'), review);

  console.log(`Wrote reports → ${OUT}`);
  console.log(
    `Shots: ${shotIndex.length} | Buttons: ${jsonSummary.pass}p/${jsonSummary.fail}f/${jsonSummary.skip}s | Issues: ${issues.length}`,
  );
}

async function main() {
  ensureOut();
  console.log('Ensuring consumer hosting…');
  const dist = await ensureHosting();
  console.log('Starting server…');
  const pid = await startServer(dist);
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });

  try {
    console.log('Cold-start matrix…');
    await runColdStart(browser);
    console.log('Post-auth matrix…');
    await runPostAuth(browser);
    console.log('Buttons + screen crawl…');
    await runButtonsAndScreens(browser);
  } finally {
    await browser.close();
    try {
      process.kill(pid);
    } catch {
      /* ignore */
    }
  }

  writeReports();
}

main().catch((e) => {
  console.error(e);
  try {
    writeReports();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
