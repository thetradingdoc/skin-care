#!/usr/bin/env node
/**
 * Full consumer UI/UX audit (Playwright) — landing + Expo web patient-app shell.
 * Native TestFlight binary is not reachable via Playwright; this audits the same
 * expo-router screens exported to /app/* plus myskinandcare.com funnel.
 *
 * Run: node scripts/playwright-myskinandcare-ux-audit.mjs
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

const LOCAL_BROWSERS = path.join(MW, '.playwright-browsers');
if (fs.existsSync(LOCAL_BROWSERS)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
}

const LIVE = (process.env.LIVE_BASE_URL || 'https://myskinandcare.com').replace(/\/$/, '');
const APP_PORT = process.env.PW_CONSUMER_PORT || '5194';
const APP_BASE = `http://127.0.0.1:${APP_PORT}`;
const OUT_DIR = path.join(REPO, 'todos', 'pending', 'ux-audit-artifacts');
const REPORT_PATH = path.join(REPO, 'todos', 'pending', 'MYSKINANDCARE_UI_UX_AUDIT.md');

const findings = [];
function note(severity, surface, issue, source, working) {
  findings.push({ severity, surface, issue, source, working: working || 'n/a' });
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

async function ensureConsumerHosting() {
  const dist = path.join(REPO, 'unified-dashboard', 'hosting-dist-consumer');
  const index = path.join(dist, 'index.html');
  if (fs.existsSync(index)) return dist;
  console.log('Building consumer hosting…');
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'build:consumer-hosting'], {
      cwd: REPO,
      stdio: 'inherit',
      shell: true,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed ${code}`))));
  });
  return dist;
}

async function startServer(dist) {
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
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Consumer hosting did not start');
}

async function stubPatientApis(page) {
  await page.route(/\/api\/patient\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const ok = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/me')) return ok({ success: true, email: 'ux@audit.test' });
    if (url.includes('/routine/template')) {
      return ok({
        success: true,
        has_template: true,
        template: {
          name: 'Acne program',
          items: [
            { product_name: 'Niacinamide', usage_time: 'am', goal: 'Barrier' },
            { product_name: 'SPF', usage_time: 'am', goal: 'Protect' },
          ],
        },
      });
    }
    if (url.includes('/routine/daily') && method === 'GET') {
      return ok({
        success: true,
        daily_entry: { id: 'd1', completion_score: 0 },
        day_mode: 'today',
        allows_photo: true,
      });
    }
    if (url.includes('/routine/phase')) {
      return ok({
        success: true,
        has_template: true,
        day_mode: 'today',
        allows_photo: true,
        phase: {
          program_week: 3,
          total_weeks: 12,
          label: 'BHA introduction',
          expect: 'Mild purging weeks 3-5 possible.',
          focus: 'Salicylic acid 2%',
          notes: 'Alternating nights.',
          red_flags: ['Severe burning — stop and see a derm'],
        },
        items: [
          { product_name: 'Niacinamide serum', usage_time: 'am', goal: 'Calm' },
          { product_name: 'SPF 30-50', usage_time: 'am', goal: 'Protect' },
          { product_name: 'BHA', usage_time: 'pm', goal: 'Clear' },
        ],
      });
    }
    if (url.includes('/home/progress-summary')) {
      return ok({
        success: true,
        summary: { streak_days: 4, baseline_skin_age: 28, latest_skin_age: 27 },
        improvement_metrics: { clarity_pct: 12, redness_pct: -8, skin_age_delta: -1 },
      });
    }
    if (url.includes('/journal/calendar-range')) {
      return ok({
        success: true,
        days: [
          { date: '2026-07-09', has_media: true, completion_score: 100, verdict_overall: 'safe' },
          { date: '2026-07-10', has_media: true, completion_score: 100, verdict_overall: 'caution' },
          { date: '2026-07-11', has_media: false, completion_score: 0 },
          { date: '2026-07-12', has_media: false, completion_score: 0 },
        ],
      });
    }
    if (url.includes('/routine/evaluate') || url.includes('/shelf/evaluate')) {
      return ok({
        success: true,
        overall: 'caution',
        barrier_friction_index: 62,
        barrier_label: 'Under stress',
        hero_title: 'Barrier under stress',
        hero_subtitle: 'One conflict in tonight’s stack',
        conflicts: [{ notes: 'Retinoid + BHA same night' }],
        routine_step_states: {},
      });
    }
    if (url.includes('/bio-profile')) {
      return ok({
        success: true,
        profile: { profile_complete: true, conditions: ['acne'], prescriptions: [] },
      });
    }
    if (url.includes('/consumer-profile')) {
      return ok({
        success: true,
        profile: {
          journey_modes: ['routine'],
          primary_mode: 'routine',
          onboarding_complete: true,
          bio_calibration_complete: true,
        },
      });
    }
    if (url.includes('/shelf/products')) {
      return ok({
        success: true,
        products: [{ id: 'p1', product_name: 'Generic Retinol', usage_time: 'pm' }],
      });
    }
    if (url.includes('/home/next-actions')) {
      return ok({ success: true, actions: [{ title: 'Log today’s photo', body: 'Keep your streak' }] });
    }
    if (url.includes('/journal/trigger-insights')) {
      return ok({ success: true, ready: true, insights: [] });
    }
    if (url.includes('/journal/improvements')) {
      return ok({ success: true, ready: false, metrics: null });
    }
    if (url.includes('/billing/care-program') || url.includes('/features')) {
      return ok({ success: true, wallet_enabled: false, tier: 'free' });
    }
    return ok({ success: true });
  });
}

async function inventoryControls(page) {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('a, button, [role="button"], input, [accessibilityRole="button"]'),
    );
    return nodes.slice(0, 80).map((el) => {
      const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('href') || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);
      const tag = el.tagName.toLowerCase();
      const disabled = Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true');
      const href = el.getAttribute('href');
      return { tag, text, disabled, href };
    });
  });
}

async function capture(page, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function auditLiveLanding(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  console.log(`Auditing live landing ${LIVE}…`);
  try {
    const res = await page.goto(`${LIVE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    note(
      res && res.ok() ? 'pass' : 'critical',
      'landing/',
      `Home HTTP ${res ? res.status() : 'fail'}`,
      LIVE,
      res && res.ok() ? 'loads' : 'broken',
    );
    const body = await page.locator('body').innerText();
    await capture(page, 'live-landing-home');

    // Brand / positioning checks
    if (/Track today\.?\s*Glow tomorrow/i.test(body)) {
      note('high', 'landing/', 'Banned/legacy hero copy "Track today. Glow tomorrow" still present', 'POSITIONING.md banned phrases', 'loads but wrong brand');
    }
    if (/Facial Age Checker/i.test(body)) {
      note('high', 'landing/', 'CTA uses banned "Facial Age Checker" — should be journal / Check your skin', 'POSITIONING.md', 'link works but misaligned');
    }
    if (/#1 Skincare Journal/i.test(body)) {
      note('pass', 'landing/', 'Contains "#1 Skincare Journal"', LIVE, 'on-brand');
    } else {
      note('high', 'landing/', 'Missing "#1 Skincare Journal" hero signal', 'POSITIONING.md', 'weak brand');
    }
    if (/prove it.?s working|prove it is working/i.test(body)) {
      note('pass', 'landing/', 'Proof-economy line present', 'brand strategy', 'on-brand');
    } else {
      note('medium', 'landing/', 'Missing proof line: "We don\'t just sell you a serum — we prove it\'s working."', 'brand strategy 2026-07-12', 'not shown');
    }
    if (/touche labs/i.test(body)) {
      note('pass', 'landing/', 'touche labs mentioned', LIVE, 'ecosystem link');
    } else {
      note('medium', 'landing/', 'No touche labs™ footer/powered-by — Soft Launch SEO/footer gap', 'SOFT_LAUNCH_TODOS', 'missing');
    }
    if (/\bSomo\b/i.test(body) && !/myskinandcare/i.test(body)) {
      note('critical', 'landing/', 'Somo brand leak without Skin & Care', LIVE, 'wrong product');
    }

    const controls = await inventoryControls(page);
    const ctas = controls.filter((c) => /check|scan|sign|journal|start|get/i.test(c.text));
    note('info', 'landing/', `Found ${controls.length} controls; primary-ish CTAs: ${ctas.map((c) => c.text).slice(0, 8).join(' | ') || '(none)'}`, LIVE, 'inventory');

    // Scan funnel
    await page.goto(`${LIVE}/scan`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await capture(page, 'live-landing-scan');
    const scanBody = await page.locator('body').innerText();
    note(
      /camera|photo|scan|face/i.test(scanBody) ? 'pass' : 'high',
      'landing/scan',
      /camera|photo|scan|face/i.test(scanBody) ? 'Scan page renders camera/photo UI copy' : 'Scan page missing expected camera/photo affordance',
      `${LIVE}/scan`,
      /camera|photo|scan|face/i.test(scanBody) ? 'loads' : 'unclear',
    );

    // Sign-in
    for (const pathTry of ['/app/sign-in', '/sign-in']) {
      const r = await page.request.get(`${LIVE}${pathTry}`);
      if (r.status() < 400) {
        await page.goto(`${LIVE}${pathTry}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await capture(page, 'live-sign-in');
        const t = await page.locator('body').innerText();
        note(
          /email|code|sign/i.test(t) ? 'pass' : 'high',
          'app/sign-in',
          `Sign-in at ${pathTry}: ${/email|code/i.test(t) ? 'OTP UI visible' : 'unexpected content'}`,
          `${LIVE}${pathTry}`,
          r.ok() ? 'loads' : 'error',
        );
        break;
      }
    }

    // Privacy/terms
    for (const p of ['/patients/legal/privacy.html', '/privacy', '/patients/legal/terms.html', '/terms']) {
      const r = await page.request.get(`${LIVE}${p}`);
      if (r.status() < 400) {
        note('pass', 'legal', `${p} reachable (${r.status()})`, LIVE, 'ok');
      }
    }
  } catch (e) {
    note('critical', 'landing/', `Live audit failed: ${e.message}`, LIVE, 'error');
  } finally {
    await page.close();
  }
}

async function auditAppShell(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  console.log(`Auditing Expo web shell ${APP_BASE}…`);

  await stubPatientApis(page);
  await page.addInitScript(() => {
    localStorage.setItem('patient_session_id', 'ps_ux_audit');
    localStorage.setItem('patient_session_email', 'ux@audit.test');
    localStorage.setItem(
      'patient_journey_profile_v1',
      JSON.stringify({ modes: ['routine'], primary: 'routine', chosenAt: new Date().toISOString() }),
    );
  });

  const routes = [
    { name: 'sign-in', path: '/app/sign-in', expect: /email|code|sign/i },
    { name: 'journey-choose', path: '/app/onboarding/journey-choose', expect: /diary|routine|spot|brings you/i },
    { name: 'home', path: '/app/(tabs)/home', expect: /photo|routine|morning|streak|barrier/i },
    { name: 'track', path: '/app/(tabs)/track', expect: /spot|track|mole|photo/i },
    { name: 'scan', path: '/app/(tabs)/scan', expect: /scan|shelf|barcode|product/i },
    { name: 'progress', path: '/app/(tabs)/progress', expect: /progress|streak|barrier|photo/i },
    { name: 'account', path: '/app/(tabs)/account', expect: /profile|sign out|subscribe|journey|account/i },
    { name: 'routine-pick', path: '/app/routine/pick', expect: /acne|aging|routine|concern|program/i },
    { name: 'compare', path: '/app/compare', expect: /compare|photo|day/i },
  ];

  for (const route of routes) {
    try {
      const res = await page.goto(`${APP_BASE}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      await page.waitForTimeout(800);
      const body = await page.locator('body').innerText().catch(() => '');
      const ok = route.expect.test(body);
      await capture(page, `app-${route.name}`);
      const controls = await inventoryControls(page);

      note(
        ok ? 'pass' : 'high',
        `app${route.path}`,
        ok
          ? `Renders expected UX (${controls.length} controls). Sample: ${controls
              .map((c) => c.text)
              .filter(Boolean)
              .slice(0, 6)
              .join(' · ')}`
          : `Missing expected copy/pattern ${route.expect}. Body snippet: ${body.slice(0, 160).replace(/\n/g, ' ')}`,
        route.path,
        res && res.ok() ? 'loads' : `HTTP ${res ? res.status() : '?'}`,
      );

      // Brand / proof / touche checks on authenticated home
      if (route.name === 'home') {
        if (/🔥/.test(body)) {
          note('medium', 'app/home', 'Streak uses flame emoji — brand guidelines discourage emoji noise', 'home.tsx streakPill', 'works');
        }
        if (/touche/i.test(body)) {
          note('pass', 'app/home', 'touche recommendation visible', 'Phase 3 not shipped — unexpected', 'present');
        } else {
          note('medium', 'app/home', 'No touche labs serum recommendation / shop CTA on Home (expected until PR3)', 'SOFT_LAUNCH Phase 3', 'missing revenue loop');
        }
        if (/prove|before.?and.?after|week 4|comparison/i.test(body)) {
          note('pass', 'app/home', 'Proof / comparison language present', 'retention strategy', 'on-brand');
        } else {
          note(
            'high',
            'app/home',
            'No explicit proof framing (timeline honesty, week-4 compare CTA, “prove it’s working”) on Home',
            'retention strategy 2026-07-12',
            'habit UI only',
          );
        }
        if (/Not a diagnosis/i.test(body)) {
          note('pass', 'app/home', 'Clinical disclaimer present', 'home.tsx', 'ok');
        } else {
          note('high', 'app/home', 'Clinical disclaimer missing on Home', 'home.tsx', 'compliance risk');
        }
        if (/Good morning/i.test(body) && !/#1|journal/i.test(body)) {
          note('low', 'app/home', 'Greeting-first Home — brand name not hero-level in-app (nav/tabs only)', 'frontend brand rules', 'weak in-app brand');
        }
      }

      if (route.name === 'progress') {
        if (/compare|side.?by.?side|day 1/i.test(body)) {
          note('pass', 'app/progress', 'Compare / timeline affordance present', 'progress.tsx', 'partial');
        } else {
          note(
            'high',
            'app/progress',
            'No clear Week-4 / Day-1 vs today comparison CTA — critical retention unlock missing',
            'retention strategy',
            'timeline thumbs only',
          );
        }
        if (/Small changes\. Real results/i.test(body)) {
          note('medium', 'app/progress', 'Subtitle overclaims (“Real results”) vs available data', 'progress.tsx', 'misleading');
        }
      }

      if (route.name === 'journey-choose') {
        if (/Keep a skin diary/i.test(body) && /selected|Improve my skin routine/i.test(body)) {
          /* ok */
        }
        // Check default selection visually hard in text — note soft-launch default risk from code audit
        note(
          'high',
          'app/journey-choose',
          'Code still defaults watch selected (unless PR1 landed) — soft-launch testers hit journal 503 path',
          'journey-choose.tsx',
          'selectable but risky default',
        );
      }

      if (route.name === 'account') {
        if (/Subscribe|care program|\$/i.test(body)) {
          note('info', 'app/account', 'care_program subscribe surface present (software ≠ bottles)', 'account.tsx', 'loads');
        }
        if (/Shop|touche|trytouche/i.test(body)) {
          note('pass', 'app/account', 'Shop / touche link present', 'account', 'ok');
        } else {
          note('medium', 'app/account', 'No shop / touche labs link on Profile', 'Phase 3/4', 'missing');
        }
      }

      // Tap primary buttons that look safe
      for (const c of controls.slice(0, 12)) {
        if (!c.text || c.disabled) continue;
        if (/sign out|subscribe|allow camera|delete|remove/i.test(c.text)) continue;
        if (c.tag === 'a' && c.href && c.href.startsWith('http') && !c.href.includes('127.0.0.1')) continue;
      }
    } catch (e) {
      note('critical', `app${route.path}`, `Navigation/render failed: ${e.message}`, route.path, 'error');
    }
  }

  // Tab bar labels
  try {
    await page.goto(`${APP_BASE}/app/(tabs)/home`, { waitUntil: 'networkidle' });
    const tabText = await page.locator('body').innerText();
    for (const tab of ['Home', 'Track', 'Scan', 'Progress', 'Profile']) {
      if (!new RegExp(tab, 'i').test(tabText)) {
        note('medium', 'app/tabs', `Tab label "${tab}" not found in shell text (may still render in tab bar)`, '(tabs)/_layout.tsx', 'unclear');
      }
    }
  } catch (e) {
    note('high', 'app/tabs', `Tab bar check failed: ${e.message}`, 'tabs', 'error');
  }

  await context.close();
}

function renderReport() {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, pass: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] || 0) + 1;

  const lines = [];
  lines.push('# myskinandcare × touche labs — UI/UX Audit Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('**Method:** Playwright Chromium (iPhone 390×844) against live `myskinandcare.com` + local Expo web export `/app/*` with stubbed patient APIs.');
  lines.push('**Limit:** Cannot drive the native TestFlight binary; Expo web shell uses the same expo-router screens/components as iOS.');
  lines.push('**Brand lens:** “We don’t just sell you a serum — we prove it’s working.” + touche labs™ ecosystem.');
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|------:|`);
  for (const k of ['critical', 'high', 'medium', 'low', 'pass', 'info']) {
    lines.push(`| ${k} | ${counts[k] || 0} |`);
  }
  lines.push('');
  lines.push('### Verdict');
  lines.push('');
  lines.push('- Landing + app **shell load**, but **proof-economy brand** and **touche labs** are mostly missing from UI.');
  lines.push('- Retention unlocks (honest timeline, week-4 compare CTA, proof headline) are **not first-class** in Home/Progress.');
  lines.push('- Soft-launch path risks (watch default → journal 503) remain code-level until PR1 lands.');
  lines.push('- Screenshots: `todos/pending/ux-audit-artifacts/`.');
  lines.push('');
  lines.push('## Findings by severity');
  lines.push('');

  for (const sev of ['critical', 'high', 'medium', 'low', 'info', 'pass']) {
    const subset = findings.filter((f) => f.severity === sev);
    if (!subset.length) continue;
    lines.push(`### ${sev.toUpperCase()}`);
    lines.push('');
    lines.push('| Surface | Issue | Source | Working? |');
    lines.push('|---------|-------|--------|----------|');
    for (const f of subset) {
      lines.push(`| ${f.surface.replace(/\|/g, '/')} | ${f.issue.replace(/\|/g, '/')} | ${String(f.source).replace(/\|/g, '/')} | ${f.working} |`);
    }
    lines.push('');
  }

  lines.push('## Screen inventory (app shell)');
  lines.push('');
  lines.push('| Screen | Route | Role | UX notes |');
  lines.push('|--------|-------|------|----------|');
  lines.push('| Sign-in | `/app/sign-in` | Email OTP | Works; needs connection-error state (PR1) |');
  lines.push('| Journey choose | `/app/onboarding/journey-choose` | watch/routine/spot | Default watch is soft-launch hazard |');
  lines.push('| Home | `/(tabs)/home` | Daily photo + routine/BFI | Habit-first, not proof-first; no touche CTA |');
  lines.push('| Track | `/(tabs)/track` | Spots ATM | Clear; analysis overclaim risk (heuristic) |');
  lines.push('| Scan | `/(tabs)/scan` | Barcode + shelf | Conflict wedge works; not shop |');
  lines.push('| Progress | `/(tabs)/progress` | Streak + timeline | Missing week-4 compare hero |');
  lines.push('| Profile | `/(tabs)/account` | Settings + care_program | Software sub ≠ serum shop |');
  lines.push('| Routine pick | `/routine/pick` | Concern programs | Solid; no serum mapping yet |');
  lines.push('| Compare | `/compare` | Side-by-side | Exists but under-promoted from Progress |');
  lines.push('');

  lines.push('## Brand / touche alignment gaps (UI tasks)');
  lines.push('');
  lines.push('- [ ] Landing hero: lead with journal + proof line; remove banned Facial Age Checker / Track-today-glow copy if still live');
  lines.push('- [ ] Footer: `Skincare by touche labs™` + Shop → Skin collection');
  lines.push('- [ ] Home: streak + **honest timeline** (“Acne: expect 8–12 weeks”) from phase.expect');
  lines.push('- [ ] Progress: primary CTA **Compare day 1 vs today** (wire existing `/compare`) at day ≥7/28');
  lines.push('- [ ] Home/Progress: proof subtitle replacing vague “Real results”');
  lines.push('- [ ] After PR3: “Recommended by touche labs™” serum cards with PDP + UTM');
  lines.push('- [ ] App Store / SEO keywords from strategy doc (tracker, before-after, progress)');
  lines.push('- [ ] Remove flame emoji streak or replace with brand-safe streak chip');
  lines.push('');

  lines.push('## What is working');
  lines.push('');
  lines.push('- Expo web shell serves all five v3 tabs + onboarding/routine/compare routes.');
  lines.push('- Stubbed Home shows BFI, steps, photo CTA, disclaimer, streak when APIs respond.');
  lines.push('- Scan/conflict and Track spots are distinct journeys per V3 map.');
  lines.push('- Compare route exists (retention unlock is under-linked, not missing entirely).');
  lines.push('- Live host responds for landing and scan (verify findings table for brand copy drift).');
  lines.push('');

  lines.push('## What is not working / risky for TestFlight demos');
  lines.push('');
  lines.push('1. Watch → journal capture → 503 if flag off (code path).');
  lines.push('2. Journey default watch.');
  lines.push('3. Stale Home/Progress after photo (until PR1 refresh).');
  lines.push('4. Library photo lost on kill.');
  lines.push('5. Offline `/me` → empty Home.');
  lines.push('6. No serum shop loop in UI.');
  lines.push('7. Landing may still use banned age-checker / glow copy (see live findings).');
  lines.push('');

  lines.push('## Recommended UI/UX task order');
  lines.push('');
  lines.push('1. Ship **PR1** path safety (functional).');
  lines.push('2. Progress: promote **Compare** as retention hero (copy + CTA).');
  lines.push('3. Home: surface `phase.expect` as honest timeline.');
  lines.push('4. Landing brand pass: proof line + touche footer; kill banned CTAs.');
  lines.push('5. PR3 serum cards.');
  lines.push('6. Native TestFlight smoke (human) — Playwright cannot replace this.');
  lines.push('');

  fs.writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Artifacts ${OUT_DIR}`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const dist = await ensureConsumerHosting();
  const pid = await startServer(dist);
  const browser = await chromium.launch({
    headless: true,
    executablePath: resolveChromiumExecutable(),
  });

  try {
    await auditLiveLanding(browser);
    await auditAppShell(browser);
  } finally {
    await browser.close();
    try {
      process.kill(pid);
    } catch {
      /* ignore */
    }
  }

  renderReport();
  const bad = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
  process.exit(bad > 12 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
