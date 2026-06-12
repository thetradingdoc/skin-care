#!/usr/bin/env node
/**
 * Static HTML mockup audit — inventory screens, buttons, mock data.
 * Run: node scripts/playwright-redesign-mockup-audit.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const MW_ROOT = path.join(REPO_ROOT, 'middleware-platform');
const HTML_PATH =
  process.env.REDESIGN_MOCKUP_HTML ||
  path.join(REPO_ROOT, 'assets', 'myskinandcare_full_redesign_v3.html');
const OUT_JSON = path.join(MW_ROOT, 'playwright-report', 'redesign-mockup-inventory.json');
const OUT_SCREENSHOTS = path.join(MW_ROOT, 'playwright-report', 'redesign-audit-screenshots', 'mockup');

const require = createRequire(path.join(MW_ROOT, 'package.json'));
const { chromium } = require('playwright');

const LOCAL_BROWSERS = path.join(MW_ROOT, '.playwright-browsers');
if (fs.existsSync(LOCAL_BROWSERS)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = LOCAL_BROWSERS;
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

const SCREEN_ROUTES = [
  { match: /choose your journey/i, route: '/app/onboarding/journey-choose', journey: 'shared' },
  { match: /ATM-simple/i, route: '/app/(tabs)/track', journey: 'watch' },
  { match: /photo capture/i, route: '/app/track/capture', journey: 'watch' },
  { match: /spot timeline/i, route: '/app/track/[spotId]', journey: 'watch' },
  { match: /Whoop-style/i, route: '/app/(tabs)/home', journey: 'routine' },
  { match: /barcode/i, route: '/app/(tabs)/scan', journey: 'routine' },
  { match: /Verdict/i, route: '/app/verdict/[productId]', journey: 'routine' },
  { match: /both journeys/i, route: '/app/(tabs)/progress', journey: 'shared' },
];

const TARGET_SELECTORS = [
  'button',
  '.fab-btn',
  '.atm-btn',
  '.mode-card',
  '.act-primary',
  '.act-sec',
  '.alert-btn',
  '.photo-cta',
  '.sback',
  '.tab',
  '.spot-photo',
  '[style*="margin:0 14px 6px"][style*="border-radius:12px"]',
  '[style*="margin:0 14px 10px"][style*="border-radius:12px"]',
];

const MOCK_PATTERNS = [
  { key: 'scores', re: /\b\d{1,3}\s*\/\s*100\b/g },
  { key: 'bfi_values', re: /\b(?:barrier|BFI)[^\d]*(\d{2})\b/gi },
  { key: 'percentages', re: /[+-]?\d+%/g },
  { key: 'streak_days', re: /\b(\d+)\s*day streak\b/gi },
  { key: 'dates', re: /\b(?:Jun \d+|Today)\b/g },
  { key: 'product_names', re: /CeraVe [^<]+|The Ordinary [^<]+|La Roche-Posay [^<]+/g },
  { key: 'status_tags', re: /\b(?:Conflict|Watch|Safe|Critical|High)\b/g },
  { key: 'growth_copy', re: /Size appears stable|Still gathering|Worth showing a doctor/gi },
];

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function extractFunctions(text) {
  const lines = [];
  if (/choose your journey|What brings you here/i.test(text)) {
    lines.push('Select watch vs routine journey mode');
    lines.push('Dual-mode note (both journeys allowed)');
  }
  if (/Take a photo now|Upload from gallery/i.test(text)) {
    lines.push('ATM entry: camera capture, gallery upload, view timeline');
  }
  if (/Position your skin|Save photo/i.test(text)) {
    lines.push('Spot capture with body map and size reference');
  }
  if (/How has it changed|timeline-strip/i.test(text)) {
    lines.push('Spot timeline comparison strip');
    lines.push('Growth summary card');
    lines.push('Doctor alert card');
  }
  if (/barrier|Tonight's routine|Take today's photo/i.test(text)) {
    lines.push('BFI ring and barrier insight');
    lines.push('Routine step states');
    lines.push('Daily photo CTA');
    lines.push('Metric chips (conflicts, streak, skin age)');
  }
  if (/barcode|Your shelf today|Add product/i.test(text)) {
    lines.push('Barcode scanner area');
    lines.push('Shelf product list with verdict tags');
    lines.push('Add product FAB');
  }
  if (/High risk|Remove from shelf|The fix/i.test(text)) {
    lines.push('Personalized verdict hero');
    lines.push('Conflict list');
    lines.push('Suggested fix card');
    lines.push('Remove / keep actions');
  }
  if (/Your progress|Barrier score|Skin improvements|Spot tracking/i.test(text)) {
    lines.push('Streak + percentile');
    lines.push('8-day barrier grid');
    lines.push('Barrier dip insight');
    lines.push('Improvement metrics bars');
    lines.push('Spot tracking row');
  }
  return [...new Set(lines)];
}

function extractMockData(text) {
  const out = {};
  for (const { key, re } of MOCK_PATTERNS) {
    const matches = [...text.matchAll(re)].map((m) => m[0] || m[1]).filter(Boolean);
    if (matches.length) out[key] = [...new Set(matches)];
  }
  return out;
}

async function main() {
  if (!fs.existsSync(HTML_PATH)) {
    console.error('HTML not found:', HTML_PATH);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.mkdirSync(OUT_SCREENSHOTS, { recursive: true });

  const fileUrl = `file://${HTML_PATH}`;
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

  const screens = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.col')].filter((c) => c.querySelector('.lbl'));
    return cols.map((col) => {
      const lbl = col.querySelector('.lbl')?.textContent?.trim() || 'unknown';
      const phone = col.querySelector('.phone');
      return { label: lbl, html: phone ? phone.innerHTML : col.innerHTML, text: phone ? phone.innerText : col.innerText };
    });
  });

  const inventory = {
    auditedAt: new Date().toISOString(),
    source: fileUrl,
    type: 'static_html_mockup',
    screenCount: screens.length,
    screens: [],
    summary: {
      totalButtons: 0,
      nonFunctional: 0,
      mockDataFields: 0,
      issues: [],
    },
  };

  inventory.summary.issues.push(
    'Static HTML — no JavaScript handlers',
    'CSS variables undefined without design token stylesheet',
    'Tabler icons (ti ti-*) require CDN — may not render offline',
    'Profile tab content not mocked in spec',
    'Journey choose has no Continue button in mockup',
  );

  for (let i = 0; i < screens.length; i++) {
    const scr = screens[i];
    const routeMeta = SCREEN_ROUTES.find((r) => r.match.test(scr.label)) || {
      route: 'unknown',
      journey: 'unknown',
    };
    const screenSlug = slug(scr.label) || `screen-${i + 1}`;

    const colLocator = page.locator('.col').filter({ has: page.getByText(scr.label, { exact: false }) }).first();
    const phone = colLocator.locator('.phone').first();
    await phone.scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({
      path: path.join(OUT_SCREENSHOTS, `${String(i + 1).padStart(2, '0')}-${screenSlug}.png`),
      fullPage: false,
    });

    const buttons = [];
    for (const sel of TARGET_SELECTORS) {
      const els = phone.locator(sel);
      const count = await els.count();
      for (let j = 0; j < count; j++) {
        const el = els.nth(j);
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;

        const meta = await el.evaluate((node) => ({
          tag: node.tagName.toLowerCase(),
          className: node.className || '',
          text: (node.innerText || node.textContent || '').trim().slice(0, 120),
          hasOnClick: Boolean(node.onclick),
          hasHref: node.tagName === 'A' && Boolean(node.getAttribute('href')),
          role: node.getAttribute('role'),
        }));

        const urlBefore = page.url();
        const htmlBefore = await phone.innerHTML();
        let clickError = null;
        try {
          await el.click({ timeout: 2000, force: true });
          await page.waitForTimeout(100);
        } catch (e) {
          clickError = e.message;
        }
        const urlAfter = page.url();
        const htmlAfter = await phone.innerHTML();

        const result = {
          selector: sel,
          index: j,
          label: meta.text || sel,
          tag: meta.tag,
          className: meta.className,
          configured: false,
          hasOnClick: meta.hasOnClick,
          hasHref: meta.hasHref,
          urlChanged: urlBefore !== urlAfter,
          domChanged: htmlBefore !== htmlAfter,
          clickError,
          issue: !meta.hasOnClick && !meta.hasHref ? 'not_configured_static_mockup' : null,
        };
        buttons.push(result);
        inventory.summary.totalButtons += 1;
        if (!result.configured && !result.urlChanged) inventory.summary.nonFunctional += 1;
      }
    }

    const mockData = extractMockData(scr.text);
    inventory.summary.mockDataFields += Object.keys(mockData).length;

    inventory.screens.push({
      index: i + 1,
      label: scr.label,
      intendedRoute: routeMeta.route,
      journey: routeMeta.journey,
      functions: extractFunctions(scr.text),
      buttons,
      mockData,
      mockResults: {
        hardcoded: true,
        apiBacked: false,
        values: mockData,
      },
    });
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(inventory, null, 2));
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Screens: ${inventory.screenCount}, buttons: ${inventory.summary.totalButtons}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
