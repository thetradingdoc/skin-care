'use strict';

const fs = require('fs');
const path = require('path');

const MOCK_SESSION_ID = 'ps_e2e_journal_audit';
const PLACEHOLDER_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const OUT_JSON = path.join(__dirname, '..', '..', 'playwright-report', 'journal-ui-audit-inventory.json');
const OUT_SCREENSHOTS = path.join(__dirname, '..', '..', 'playwright-report', 'journal-ui-audit-screenshots');

function json(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function journalTimelineDaysForRange(startIso, endIso, { todayLogged = false } = {}) {
  const start = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return journalTimelineDaysForRange(start, end, { todayLogged });
  }
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const isEnd = iso === endIso;
    const daysBeforeEnd = Math.round((end.getTime() - cursor.getTime()) / 86400000);
    const hasPastPhoto = !isEnd && daysBeforeEnd > 0 && daysBeforeEnd <= 3;
    days.push({
      date: iso,
      photo_url: isEnd && todayLogged ? PLACEHOLDER_URI : hasPastPhoto ? PLACEHOLDER_URI : null,
      thumbnail_url: isEnd && todayLogged ? PLACEHOLDER_URI : hasPastPhoto ? PLACEHOLDER_URI : null,
      condition_tags: isEnd && todayLogged ? ['breaking_out'] : [],
      primary_condition: null,
      note: null,
      has_photo: isEnd ? todayLogged : hasPastPhoto,
      source: 'journal',
      completion_score: isEnd && todayLogged ? 100 : hasPastPhoto ? 100 : 0,
      has_media: isEnd ? todayLogged : hasPastPhoto,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function mockJournalImprovements() {
  return {
    success: true,
    ready: true,
    metrics: {
      redness_pct: -28,
      breakouts_pct: -36,
      texture_pct: 35,
      hydration_pct: 42,
    },
    unlock_after_days: 3,
  };
}

function mockTriggerInsights() {
  return {
    success: true,
    ready: true,
    entry_count: 12,
    insights: [
      {
        label: 'Dairy may trigger breakouts',
        body: 'Breakouts appeared 2 days after dairy-heavy meals in your notes.',
        confidence: 0.72,
        type: 'negative',
        keyword: 'dairy',
      },
    ],
  };
}

/** Seed localStorage for diary-first journey (watch mode, no routine template). */
async function seedDiaryJourney(context, apiBase) {
  await context.addInitScript(
    ({ api, sessionId }) => {
      localStorage.setItem('patient_session_id', sessionId);
      localStorage.setItem('patient_session_email', 'e2e-journal@example.com');
      localStorage.setItem('patient_api_base_url', api);
      localStorage.setItem('api_base', api);
      localStorage.setItem(
        'patient_journey_profile_v1',
        JSON.stringify({ modes: ['watch'], primary: 'watch', chosenAt: new Date().toISOString() }),
      );
      localStorage.setItem('patient_spots_v1', JSON.stringify([]));
      localStorage.setItem('patient_spots_migrated_v1', '1');
      localStorage.setItem('patient_onboarding_complete_v1', '1');
    },
    { api: apiBase, sessionId: MOCK_SESSION_ID },
  );
}

/** Route stubs for journal-first diary user (no routine template). */
async function stubJournalApis(page, options = {}) {
  const { streakDays = 0, todayLogged = false } = options;
  const pattern = /\/api\/(patient|public)\//;
  try {
    await page.unroute(pattern);
  } catch {
    /* first */
  }
  try {
    await page.unroute(/\/api\/patient\/home\/progress-summary/);
  } catch {
    /* first */
  }

  await page.route(pattern, async (route) => {
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

    if (url.includes('/consumer-profile')) {
      let body = {};
      if (method === 'PATCH') {
        try {
          body = (await route.request().postDataJSON()) || {};
        } catch {
          body = {};
        }
      }
      return route.fulfill(
        json({
          success: true,
          profile: {
            journey_modes: body.journey_modes || ['watch'],
            primary_mode: body.primary_mode || 'watch',
            onboarding_complete: true,
            bio_calibration_complete: false,
            needs_first_photo: false,
            chosen_at: body.chosen_at || new Date().toISOString(),
          },
        }),
      );
    }

    if (url.includes('/api/patient/me') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          patient: { id: 'pat_e2e', email: 'e2e-journal@example.com' },
        }),
      );
    }

    if (url.includes('/routine/template')) {
      return route.fulfill(json({ success: true, has_template: false, template: null }));
    }

    if (url.includes('/routine/daily') && !url.includes('/photo')) {
      return route.fulfill(
        json({
          success: true,
          has_template: false,
          day_mode: 'today',
          allows_photo: true,
          daily_entry: null,
        }),
      );
    }

    if (url.includes('/routine/phase')) {
      return route.fulfill(json({ success: true, has_template: false, phase: null, items: [] }));
    }

    if (url.includes('/home/progress-summary')) {
      return route.fulfill(
        json({
          success: true,
          summary: {
            streak_days: streakDays,
            baseline_skin_age: streakDays > 0 ? 32 : null,
            latest_skin_age: streakDays > 0 ? 27 : null,
          },
          improvement_metrics: streakDays > 0 ? { clarity_pct: 18, redness_pct: -34 } : {},
        }),
      );
    }

    if (url.includes('/home/next-actions')) {
      return route.fulfill(json({ success: true, actions: [] }));
    }

    if (url.includes('/journal/calendar-range')) {
      const u = new URL(url, 'http://127.0.0.1');
      const startIso = u.searchParams.get('start');
      const endIso = u.searchParams.get('end');
      const days =
        startIso && endIso
          ? journalTimelineDaysForRange(startIso, endIso, { todayLogged })
          : journalTimelineDaysForRange(
              new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
              new Date().toISOString().slice(0, 10),
              { todayLogged },
            );
      return route.fulfill(json({ success: true, days }));
    }

    if (url.includes('/journal/timeline') && method === 'GET') {
      const endIso = new Date().toISOString().slice(0, 10);
      const startIso = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      return route.fulfill(
        json({ success: true, days: journalTimelineDaysForRange(startIso, endIso, { todayLogged }) }),
      );
    }

    if (url.includes('/journal/trigger-insights')) {
      return route.fulfill(json(mockTriggerInsights()));
    }

    if (url.includes('/journal/improvements')) {
      return route.fulfill(json(mockJournalImprovements()));
    }

    if (url.includes('/journal/daily-photo') && method === 'POST') {
      const today = new Date().toISOString().slice(0, 10);
      return route.fulfill(
        json({
          success: true,
          entry_id: 'je_e2e_1',
          entry_date: today,
          photo_url: PLACEHOLDER_URI,
          condition_tags: [],
          primary_condition: null,
          note: null,
          has_photo: true,
          source: 'standalone',
        }),
      );
    }

    if (url.includes('/journal/daily-entry') && method === 'PATCH') {
      const today = new Date().toISOString().slice(0, 10);
      return route.fulfill(
        json({
          success: true,
          entry_id: 'je_e2e_1',
          entry_date: today,
          photo_url: null,
          condition_tags: ['calm'],
          primary_condition: 'Calm',
          note: 'Test note',
          has_photo: false,
        }),
      );
    }

    if (url.includes('/routine/evaluate')) {
      return route.fulfill(
        json({
          success: true,
          overall: 'safe',
          barrier_friction_index: 72,
          hero_title: null,
          conflicts: [],
          product_statuses: [],
        }),
      );
    }

    if (url.includes('/routine/verdict-history')) {
      const days = [58, 61, 65, 68, 70, 71, 72, 72].map((bfi, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (7 - i));
        return {
          date: d.toISOString().slice(0, 10),
          barrier_friction_index: bfi,
          overall: bfi < 65 ? 'caution' : 'safe',
        };
      });
      return route.fulfill(json({ success: true, days }));
    }

    if (url.includes('/bio-profile')) {
      return route.fulfill(
        json({
          success: true,
          profile: { profile_complete: false, conditions: [], prescriptions: [] },
        }),
      );
    }

    if (url.includes('/spots') && method === 'GET') {
      return route.fulfill(json({ success: true, spots: [] }));
    }

    if (url.includes('/shelf/products') && method === 'GET') {
      return route.fulfill(json({ success: true, products: [] }));
    }

    if (url.includes('/goals') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          goals: [{ id: 'g1', goal_type: 'keep_journal', status: 'active', source: 'onboarding' }],
        }),
      );
    }

    if (url.includes('/billing/subscription')) {
      return route.fulfill(json({ success: true, subscription: { tier: 'free' } }));
    }

    if (url.includes('/features')) {
      return route.fulfill(json({ success: true, features: {} }));
    }

    return route.fulfill(json({ success: true }));
  });
}

/** Stub with active streak + journal metrics for progress screen audit. */
async function stubJournalApisWithStreak(page) {
  await stubJournalApis(page, { streakDays: 14 });
}

async function assertTypography(page, locator, expected) {
  const styles = await locator.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      fontFamily: cs.fontFamily,
      fontSize: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
    };
  });
  const issues = [];
  if (expected.fontSizeMin != null && styles.fontSize < expected.fontSizeMin) {
    issues.push(`fontSize ${styles.fontSize}px < min ${expected.fontSizeMin}px`);
  }
  if (expected.fontSizeMax != null && styles.fontSize > expected.fontSizeMax) {
    issues.push(`fontSize ${styles.fontSize}px > max ${expected.fontSizeMax}px`);
  }
  if (expected.serif && !/gloock|georgia|serif|ui-serif/i.test(styles.fontFamily)) {
    issues.push(`fontFamily "${styles.fontFamily}" is not serif/Gloock`);
  }
  if (expected.fontWeight && styles.fontWeight !== expected.fontWeight) {
    issues.push(`fontWeight ${styles.fontWeight} !== ${expected.fontWeight}`);
  }
  return { pass: issues.length === 0, issues, actual: styles };
}

async function assertComputedColor(page, locator, property, expectedHex) {
  const rgb = await locator.evaluate((el, prop) => getComputedStyle(el)[prop], property);
  const hex = rgbToHex(rgb);
  const normalized = expectedHex.toLowerCase();
  const pass = hex === normalized;
  return { pass, actual: hex, expected: normalized, property };
}

function rgbToHex(rgb) {
  const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  const r = Number(m[1]).toString(16).padStart(2, '0');
  const g = Number(m[2]).toString(16).padStart(2, '0');
  const b = Number(m[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

async function captureScreenAudit(page, screenId, inventory) {
  fs.mkdirSync(OUT_SCREENSHOTS, { recursive: true });
  const screenshotPath = path.join(OUT_SCREENSHOTS, `${screenId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const row = {
    id: screenId,
    screenshot: screenshotPath,
    url: page.url(),
    capturedAt: new Date().toISOString(),
  };
  if (inventory) inventory.screens.push(row);
  return row;
}

function createInventory() {
  return {
    auditedAt: null,
    source: 'journal_first_ui_audit',
    type: 'expo_web_consumer_hosting',
    functional: [],
    parity: [],
    summary: { functionalPassed: 0, functionalFailed: 0, parityPassed: 0, parityFailed: 0 },
    screens: [],
  };
}

function recordFunctional(inventory, id, pass, detail) {
  inventory.functional.push({ id, pass, detail });
  if (pass) inventory.summary.functionalPassed += 1;
  else inventory.summary.functionalFailed += 1;
}

function recordParity(inventory, id, pass, detail, severity = 'medium') {
  inventory.parity.push({ id, pass, detail, severity });
  if (pass) inventory.summary.parityPassed += 1;
  else inventory.summary.parityFailed += 1;
}

function writeInventory(inventory) {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  inventory.auditedAt = new Date().toISOString();
  fs.writeFileSync(OUT_JSON, JSON.stringify(inventory, null, 2));
  return OUT_JSON;
}

module.exports = {
  MOCK_SESSION_ID,
  OUT_JSON,
  OUT_SCREENSHOTS,
  seedDiaryJourney,
  stubJournalApis,
  stubJournalApisWithStreak,
  assertTypography,
  assertComputedColor,
  captureScreenAudit,
  createInventory,
  recordFunctional,
  recordParity,
  writeInventory,
  journalTimelineDaysForRange,
  mockJournalImprovements,
  mockTriggerInsights,
};
