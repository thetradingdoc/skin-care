#!/usr/bin/env node
/**
 * Touche full-screen Playwright audit — every tab + capture/auth/profile route.
 * Bypasses OTP via localStorage session + API route stubs (incl. medical-tracker facts APIs).
 *
 * Usage:
 *   node scripts/playwright-touche-full-screen-audit.cjs
 *   BASE_URL=https://app.trytouche.com node scripts/playwright-touche-full-screen-audit.cjs
 *   LIVE_NO_STUB=1 BASE_URL=https://app.trytouche.com node scripts/playwright-touche-full-screen-audit.cjs
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
  MOCK_SESSION_ID,
  MOCK_EMAIL,
  bootstrapMobileSession,
  stubMobileAppApis,
} = require(path.join(MW, 'e2e/helpers/mobile-app-mocks.cjs'));

const LOCAL_BROWSERS = path.join(MW, '.playwright-browsers');
if (fs.existsSync(LOCAL_BROWSERS)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
}

const LIVE_BASE = (process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || '').replace(/\/$/, '');
const USE_LIVE = Boolean(LIVE_BASE);
const LIVE_NO_STUB = process.env.LIVE_NO_STUB === '1';
const APP_PORT = process.env.PW_CONSUMER_PORT || '5299';
const APP_BASE = USE_LIVE ? LIVE_BASE : `http://127.0.0.1:${APP_PORT}`;
const OUT = path.join(REPO, 'todos', 'pending', `touche-full-screen-audit-${new Date().toISOString().slice(0, 10)}`);
const SHOTS = path.join(OUT, 'screenshots');

const TAGS = ['skin', 'bill', 'rx', 'mark', 'lab', 'other'];

/** Routes under /app — medical tracker IA + related surfaces */
const ROUTES = [
  // Cold / auth
  { path: '/welcome', area: 'cold', needSession: false },
  { path: '/sign-in', area: 'auth', needSession: false },
  { path: '/auth/otp-entry', area: 'auth', needSession: false },
  { path: '/auth/otp-error', area: 'auth', needSession: false },
  { path: '/get-the-app', area: 'cold', needSession: false },
  { path: '/capture/consent', area: 'capture', needSession: false },
  // Capture machine
  { path: '/capture', area: 'capture', needSession: false },
  { path: '/capture/camera-denied', area: 'capture', needSession: false },
  { path: '/capture/vision-fail', area: 'capture', needSession: false },
  { path: '/capture/manual-entry', area: 'capture', needSession: false },
  { path: '/capture/tag', area: 'capture', needSession: false },
  { path: '/capture/loading', area: 'capture', needSession: false },
  { path: '/capture/ai-cap', area: 'capture', needSession: true },
  { path: '/capture/ai-burst', area: 'capture', needSession: true },
  { path: '/capture/welcome-bonus', area: 'capture', needSession: true },
  { path: '/capture/unlock-ai', area: 'capture', needSession: true },
  { path: '/capture/daily-ai-suggests', area: 'capture', needSession: true },
  { path: '/capture/opqrst-lite', area: 'capture', needSession: false },
  { path: '/capture/routine-nudge', area: 'capture', needSession: false },
  { path: '/capture/mark-picker', area: 'capture', needSession: true },
  { path: '/capture/mark-compare', area: 'capture', needSession: true },
  ...TAGS.flatMap((t) => [
    { path: `/capture/confirm/${t}`, area: 'confirm', needSession: false },
    { path: `/capture/reveal/${t}`, area: 'reveal', needSession: false },
    { path: `/capture/thesis/${t}`, area: 'thesis', needSession: false },
  ]),
  // 5 tabs
  { path: '/calendar', area: 'tabs', needSession: true },
  { path: '/shelf', area: 'tabs', needSession: true },
  { path: '/track', area: 'tabs', needSession: true },
  { path: '/progress', area: 'tabs', needSession: true },
  { path: '/account', area: 'tabs', needSession: true },
  // Profile
  { path: '/profile/language', area: 'profile', needSession: true },
  { path: '/profile/share-with-doctor', area: 'profile', needSession: true },
  { path: '/profile/notifications', area: 'profile', needSession: true },
  { path: '/profile/consent-privacy', area: 'profile', needSession: true },
  { path: '/profile/allergens', area: 'profile', needSession: true },
  { path: '/alerts', area: 'profile', needSession: true },
  // Shelf / shop / scan
  { path: '/shelf/rx-refill-info', area: 'shelf', needSession: true },
  { path: '/scan-entry', area: 'shelf', needSession: true },
  { path: '/shop', area: 'commerce', needSession: false },
  { path: `/verdict/${MOCK_PRODUCT_ID}`, area: 'shelf', needSession: true },
  { path: '/barcode-verdict-depth', area: 'shelf', needSession: true },
  // Try funnel
  { path: '/try-verdict', area: 'try', needSession: false },
  { path: '/try-allergens', area: 'try', needSession: false },
  { path: '/try-reveal', area: 'try', needSession: false },
  { path: '/try-handoff', area: 'try', needSession: false },
  // Onboarding / routine
  { path: '/onboarding/journey-choose', area: 'onboarding', needSession: true },
  { path: '/onboarding/concerns', area: 'onboarding', needSession: false },
  { path: '/onboarding/signup', area: 'onboarding', needSession: false },
  { path: '/routine/pick', area: 'routine', needSession: true },
  { path: '/routine/setup', area: 'routine', needSession: true },
  // Legacy / redirects
  { path: '/check', area: 'legacy', needSession: false },
  { path: '/severity', area: 'legacy', needSession: false },
  { path: '/_journal', area: 'legacy', needSession: true },
  { path: '/compare', area: 'legacy', needSession: true },
  { path: '/proof', area: 'legacy', needSession: true },
  { path: '/track/capture', area: 'capture', needSession: true },
];

const results = [];
const failures = [];
const designIssues = [];

function appUrl(p) {
  const rel = p.startsWith('/') ? p : `/${p}`;
  return `${APP_BASE}/app${rel}`;
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

async function ensureLocalHosting() {
  if (USE_LIVE) return null;
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
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${APP_BASE}/app/welcome`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) return child.pid;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Local hosting did not start');
}

function json(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

/** Extra stubs for medical-tracker facts surfaces (beyond mobile-app-mocks). */
async function stubMedicalTrackerApis(page) {
  await page.route(/\/api\/patient\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, x-session-id',
        },
      });
    }
    if (url.includes('/records/calendar')) {
      return route.fulfill(
        json({
          success: true,
          days: [
            {
              date: new Date().toISOString().slice(0, 10),
              entry_count: 2,
              tags: ['skin', 'bill'],
              confirmed_count: 2,
            },
          ],
        }),
      );
    }
    if (url.includes('/progress/aggregates')) {
      return route.fulfill(
        json({
          success: true,
          aggregates: {
            confirmed_total: 4,
            by_tag: { skin: 2, bill: 1, mark: 1 },
            days_with_entries: 3,
          },
        }),
      );
    }
    if (url.includes('/marks/compare-group')) {
      return route.fulfill(
        json({
          success: true,
          entries: [
            { id: 'f1', entry_date: '2026-06-01', confirmed_at: '2026-06-01T12:00:00Z' },
            { id: 'f2', entry_date: new Date().toISOString().slice(0, 10), confirmed_at: new Date().toISOString() },
          ],
        }),
      );
    }
    if (url.includes('/marks')) {
      return route.fulfill(
        json({
          success: true,
          marks: [
            {
              id: 'mark_1',
              label: 'Cheek mark',
              compare_group_id: 'cg_1',
              entry_count: 2,
              last_entry_date: new Date().toISOString().slice(0, 10),
            },
          ],
        }),
      );
    }
    if (url.includes('/ai/usage')) {
      return route.fulfill(
        json({
          success: true,
          usage: { used: 3, limit: 20, remaining: 17, welcome_bonus_remaining: 5 },
        }),
      );
    }
    if (url.includes('/ai/credits/checkout') && method === 'POST') {
      return route.fulfill(json({ success: true, url: 'https://checkout.stripe.com/e2e-ai-credits' }));
    }
    if (url.includes('/records/capture/gate') && method === 'POST') {
      return route.fulfill(json({ success: true, allowed: true, remaining: 17 }));
    }
    if (url.includes('/records/capture') && method === 'POST') {
      return route.fulfill(
        json({
          success: true,
          fact: { id: 'fact_e2e_1', tag: 'skin', confirmed_at: null },
          confirm_href: '/capture/confirm/skin',
        }),
      );
    }
    if (url.includes('/records/') && url.includes('/confirm') && method === 'POST') {
      return route.fulfill(json({ success: true, fact: { id: 'fact_e2e_1', confirmed_at: new Date().toISOString() } }));
    }
    if (url.includes('/export/physician')) {
      return route.fulfill(
        json({
          success: true,
          url: 'https://example.com/physician.pdf',
          token: 'share_e2e',
        }),
      );
    }
    if (url.includes('/alerts')) {
      return route.fulfill(json({ success: true, alerts: [] }));
    }
    if (url.includes('/shelf/ask-learn') && method === 'POST') {
      return route.fulfill(json({ success: true, reply: 'Stub Ask/Learn reply for E2E.' }));
    }
    // Fall through to default stub handler by aborting this route layer — re-delegate
    return route.fallback();
  });
}

async function analyzePage(page, routeDef) {
  const url = page.url();
  const body = ((await page.locator('body').innerText().catch(() => '')) || '').trim();
  const title = await page.title().catch(() => '');
  const issues = [];

  if (/Unmatched Route/i.test(body)) {
    issues.push({ severity: 'critical', kind: 'unmatched_route', detail: 'Expo unmatched route' });
  }
  if (!body || body.length < 8) {
    issues.push({ severity: 'critical', kind: 'blank_screen', detail: `body length ${body.length}` });
  }
  if (/Something went wrong|Application error|TypeError|Cannot read/i.test(body)) {
    issues.push({ severity: 'critical', kind: 'runtime_error', detail: body.slice(0, 200) });
  }
  if (/404|Not Found/i.test(body) && routeDef.area !== 'legacy') {
    issues.push({ severity: 'high', kind: 'not_found', detail: body.slice(0, 120) });
  }

  // Design / review-killers
  if (routeDef.path.includes('/confirm/rx') || routeDef.path.includes('/reveal/rx')) {
    if (/\bBuy\b/.test(body)) {
      issues.push({ severity: 'critical', kind: 'rx_buy_cta', detail: 'Buy CTA on Rx surface' });
    }
  }
  if (routeDef.path === '/progress' && /Skin & Care/i.test(body) && !/touche/i.test(body)) {
    issues.push({ severity: 'medium', kind: 'brand_drift', detail: 'Progress shows Skin & Care without touche' });
  }
  if (routeDef.path === '/onboarding/signup' && /Skin & Care/i.test(body)) {
    issues.push({ severity: 'high', kind: 'brand_drift', detail: 'Signup still Skin & Care' });
  }
  if (routeDef.path === '/compare') {
    issues.push({
      severity: 'high',
      kind: 'legacy_compare',
      detail: 'Legacy compare route still reachable (Progress CTA risk)',
    });
  }
  if (routeDef.area === 'tabs' && /Sign in|email|Send code/i.test(body) && routeDef.needSession) {
    issues.push({
      severity: 'high',
      kind: 'auth_gate_unexpected',
      detail: 'Tab redirected/gated to auth despite session stub',
    });
  }
  if (routeDef.path === '/capture' && /PDF/i.test(body)) {
    // note only — client may still be images-only
    designIssues.push({
      path: routeDef.path,
      kind: 'pdf_copy',
      detail: 'Capture copy mentions PDF — verify DocumentPicker exists',
    });
  }

  // Empty-as-success heuristic on tabs with stubs that return data
  if (routeDef.path === '/progress' && /Nothing|empty|No entries|0 confirmed/i.test(body) && !LIVE_NO_STUB) {
    issues.push({
      severity: 'high',
      kind: 'empty_despite_stub',
      detail: 'Progress looks empty while aggregates stub returns data — wire/API contract mismatch',
    });
  }
  if (routeDef.path === '/calendar' && /Nothing|No days|empty month|No entries/i.test(body) && !LIVE_NO_STUB) {
    issues.push({
      severity: 'high',
      kind: 'empty_despite_stub',
      detail: 'Calendar empty despite calendar stub',
    });
  }
  if (routeDef.path === '/track' && /No marks|Nothing tracked|empty/i.test(body) && !LIVE_NO_STUB) {
    issues.push({
      severity: 'medium',
      kind: 'empty_despite_stub',
      detail: 'Track empty despite marks stub',
    });
  }

  return { url, title, bodyPreview: body.slice(0, 280).replace(/\s+/g, ' '), issues };
}

async function visitRoute(browser, routeDef, mode) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const consoleErrors = [];
  const pageErrors = [];

  if (routeDef.needSession !== false) {
    await bootstrapMobileSession(context, {
      journeyModes: ['watch', 'routine'],
      withSpot: false,
    });
  } else {
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('patient_session_id');
        localStorage.removeItem('patient_session_email');
      } catch {
        /* ignore */
      }
    });
  }

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('pageerror', (err) => pageErrors.push(String(err.message || err).slice(0, 200)));

  try {
    if (!LIVE_NO_STUB) {
      await stubMedicalTrackerApis(page);
      await stubMobileAppApis(page, {
        journeyModes: ['watch', 'routine'],
        hasTemplate: true,
        bioComplete: true,
        emptyShelf: false,
      });
    }

    const target = appUrl(routeDef.path);
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1100);

    const analysis = await analyzePage(page, routeDef);
    const slug = routeDef.path.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const shotPath = path.join(SHOTS, `${mode}-${routeDef.area}-${slug}.png`);
    await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

    const row = {
      path: routeDef.path,
      area: routeDef.area,
      mode,
      finalUrl: analysis.url,
      title: analysis.title,
      bodyPreview: analysis.bodyPreview,
      issues: analysis.issues,
      consoleErrors: consoleErrors.slice(0, 5),
      pageErrors: pageErrors.slice(0, 5),
      screenshot: path.relative(REPO, shotPath),
      ok: analysis.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0,
    };
    results.push(row);
    for (const iss of analysis.issues) {
      failures.push({ path: routeDef.path, ...iss, finalUrl: analysis.url });
    }
    if (pageErrors.length) {
      failures.push({
        path: routeDef.path,
        severity: 'high',
        kind: 'pageerror',
        detail: pageErrors[0],
        finalUrl: analysis.url,
      });
    }
    return row;
  } catch (e) {
    const row = {
      path: routeDef.path,
      area: routeDef.area,
      mode,
      ok: false,
      error: (e.message || String(e)).slice(0, 300),
    };
    results.push(row);
    failures.push({
      path: routeDef.path,
      severity: 'critical',
      kind: 'navigation_failed',
      detail: row.error,
    });
    return row;
  } finally {
    await context.close();
  }
}

async function clickTabBar(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await bootstrapMobileSession(context, { journeyModes: ['watch', 'routine'] });
  const page = await context.newPage();
  try {
    if (!LIVE_NO_STUB) {
      await stubMedicalTrackerApis(page);
      await stubMobileAppApis(page, { journeyModes: ['watch', 'routine'], hasTemplate: true, bioComplete: true });
    }
    await page.goto(appUrl('/progress'), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1200);
    const tabs = ['Calendar', 'Shelf', 'Track', 'Progress', 'Profile'];
    const tabResults = [];
    for (const name of tabs) {
      const loc = page.getByRole('tab', { name: new RegExp(name, 'i') }).or(page.getByText(name, { exact: true }));
      try {
        await loc.first().click({ timeout: 5000 });
        await page.waitForTimeout(900);
        const body = (await page.locator('body').innerText().catch(() => '')) || '';
        const unmatched = /Unmatched Route/i.test(body);
        tabResults.push({
          tab: name,
          url: page.url(),
          ok: !unmatched && body.length > 10,
          unmatched,
          preview: body.slice(0, 160).replace(/\s+/g, ' '),
        });
        if (unmatched || body.length < 10) {
          failures.push({
            path: `tab:${name}`,
            severity: 'critical',
            kind: unmatched ? 'unmatched_route' : 'blank_screen',
            detail: 'Tab bar navigation failed',
            finalUrl: page.url(),
          });
        }
        await page.screenshot({
          path: path.join(SHOTS, `tabbar-${name.toLowerCase()}.png`),
          fullPage: false,
        }).catch(() => {});
      } catch (e) {
        tabResults.push({ tab: name, ok: false, error: e.message });
        failures.push({
          path: `tab:${name}`,
          severity: 'critical',
          kind: 'tab_click_failed',
          detail: e.message,
        });
      }
    }
    return tabResults;
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  let serverPid = null;
  if (!USE_LIVE) {
    const dist = await ensureLocalHosting();
    serverPid = await startServer(dist);
    console.log(`Serving local hosting on ${APP_BASE} (pid ${serverPid})`);
  } else {
    console.log(`Using live BASE_URL=${APP_BASE} stubs=${LIVE_NO_STUB ? 'OFF' : 'ON'}`);
  }

  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    executablePath,
  });

  const mode = USE_LIVE ? (LIVE_NO_STUB ? 'live-nostub' : 'live-stub') : 'local-stub';

  console.log(`Crawling ${ROUTES.length} routes…`);
  for (const route of ROUTES) {
    process.stdout.write(`  ${route.path} … `);
    const row = await visitRoute(browser, route, mode);
    console.log(row.ok ? 'OK' : `FAIL (${(row.issues || []).map((i) => i.kind).join(',') || row.error || 'err'})`);
  }

  console.log('Clicking tab bar…');
  const tabResults = await clickTabBar(browser);

  await browser.close();
  if (serverPid) {
    try {
      process.kill(serverPid);
    } catch {
      /* ignore */
    }
  }

  const critical = failures.filter((f) => f.severity === 'critical');
  const high = failures.filter((f) => f.severity === 'high');
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: APP_BASE,
    mode,
    routeCount: ROUTES.length,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    failureCount: failures.length,
    criticalCount: critical.length,
    highCount: high.length,
    tabResults,
    designIssues,
    failures,
    results,
  };

  const jsonPath = path.join(OUT, 'audit-report.json');
  const mdPath = path.join(OUT, 'AUDIT_SUMMARY.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    `# Touche full-screen Playwright audit`,
    '',
    `- Generated: ${report.generatedAt}`,
    `- Base: ${APP_BASE}`,
    `- Mode: ${mode}`,
    `- Routes: ${report.routeCount} · OK ${report.okCount} · FAIL ${report.failCount}`,
    `- Failures: ${report.failureCount} (critical ${report.criticalCount}, high ${report.highCount})`,
    '',
    `## Tab bar`,
    '',
    ...(tabResults || []).map((t) => `- **${t.tab}**: ${t.ok ? 'OK' : 'FAIL'} — ${t.url || t.error || ''}`),
    '',
    `## Critical / high failures`,
    '',
    ...failures
      .filter((f) => f.severity === 'critical' || f.severity === 'high')
      .map((f) => `- **[${f.severity}]** \`${f.path}\` — ${f.kind}: ${f.detail || ''}`),
    '',
    `## Design notes`,
    '',
    ...designIssues.map((d) => `- \`${d.path}\` — ${d.kind}: ${d.detail}`),
    '',
    `Full JSON: \`${path.relative(REPO, jsonPath)}\``,
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(`\nWrote ${path.relative(REPO, mdPath)}`);
  console.log(`Critical=${critical.length} High=${high.length}`);
  process.exit(critical.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
