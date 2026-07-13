/**
 * App Store screenshots of the Expo web patient app (/app/*).
 * Uses live host + stubbed patient APIs (no real OTP login).
 *
 * Run from repo root:
 *   node unified-dashboard/skin-care-landing/scripts/app-screenshots.js
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, 'screenshots', 'app');
const APP_BASE = (process.env.APP_BASE_URL || 'https://myskinandcare.com').replace(/\/$/, '');

const SCREENS = [
  { name: 'app-sign-in', path: '/app/sign-in', stubAuth: false },
  { name: 'app-home', path: '/app/home', stubAuth: true },
  { name: 'app-progress', path: '/app/progress', stubAuth: true },
  { name: 'app-track', path: '/app/track', stubAuth: true },
  { name: 'app-scan', path: '/app/scan', stubAuth: true },
  { name: 'app-account', path: '/app/account', stubAuth: true },
  { name: 'app-compare', path: '/app/compare', stubAuth: true },
  { name: 'app-journey-choose', path: '/app/onboarding/journey-choose', stubAuth: true },
];

async function stubPatientApis(page) {
  await page.route(/\/api\/patient\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const ok = (body) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/me')) return ok({ success: true, email: 'review@touche.app' });
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

async function seedSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('patient_session_id', 'ps_appstore_shot');
    localStorage.setItem('patient_session_email', 'review@touche.app');
    localStorage.setItem(
      'patient_journey_profile_v1',
      JSON.stringify({
        journey_modes: ['routine'],
        primary_mode: 'routine',
        onboarding_complete: true,
      })
    );
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Capturing app screens from ${APP_BASE}`);
  console.log(`Output: ${OUT_DIR}\n`);

  const browser = await chromium.launch();

  for (const screen of SCREENS) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();

    if (screen.stubAuth) {
      await stubPatientApis(page);
      await seedSession(page);
    }

    const url = `${APP_BASE}${screen.path}`;
    console.log(`→ ${screen.name}: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2500);
      const out = path.join(OUT_DIR, `${screen.name}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  Saved ${screen.name}.png`);
    } catch (err) {
      console.error(`  FAILED ${screen.name}: ${err.message}`);
    }
    await context.close();
  }

  await browser.close();
  console.log(`\nAll app screenshots saved to ${OUT_DIR}`);
})();
