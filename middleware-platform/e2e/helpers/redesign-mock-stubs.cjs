'use strict';

/** API stubs aligned with myskinandcare_full_redesign_v3.html mock data */

const MOCK_PRODUCT_ID = 'shelf_cerave_retinol';
const MOCK_VERDICT_PRODUCT_ID = 'shelf_cerave_sa';
const MOCK_SESSION_ID = 'ps_e2e_redesign_parity';
const PLACEHOLDER_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

function mockSpotSnapshots() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { date: '2026-06-01', uri: PLACEHOLDER_URI, thumbnail_url: PLACEHOLDER_URI, change_tag: 'alert', size_signal: 0.1 },
    { date: '2026-06-08', uri: PLACEHOLDER_URI, thumbnail_url: PLACEHOLDER_URI, change_tag: 'watch', size_signal: 0.08 },
    { date: '2026-06-13', uri: PLACEHOLDER_URI, thumbnail_url: PLACEHOLDER_URI, change_tag: 'watch', size_signal: 0.07 },
    { date: today, uri: PLACEHOLDER_URI, thumbnail_url: PLACEHOLDER_URI, change_tag: 'same', size_signal: 0.05 },
  ];
}

const MOCK_EVALUATE = {
  success: true,
  overall: 'caution',
  compatibility_score: 62,
  barrier_friction_index: 62,
  barrier_label: 'Barrier under stress',
  hero_title: 'Barrier under stress',
  hero_subtitle: 'Your products clashed last night. Ease off actives today.',
  graph_unavailable: false,
  conflicts: [
    { ingredient_a: 'salicylic acid', ingredient_b: 'retinol', notes: 'Separate AM/PM', severity: 'critical' },
    { ingredient_a: 'BHA', ingredient_b: 'retinol', notes: 'Rosacea flare risk', severity: 'high' },
  ],
  product_statuses: [
    { shelf_product_id: MOCK_PRODUCT_ID, product_name: 'CeraVe Retinol Serum', status: 'conflict', usage_time: 'pm' },
    { shelf_product_id: 'shelf_niacinamide', product_name: 'The Ordinary Niacinamide', status: 'watch', usage_time: 'am' },
    { shelf_product_id: 'shelf_spf', product_name: 'La Roche-Posay SPF 50', status: 'safe', usage_time: 'am' },
  ],
  routine_step_states: [
    { label: 'Gentle cleanser', sub: 'Safe · pH 5.5', state: 'done' },
    { label: 'Retinol 0.5%', sub: 'Skip — barrier too low tonight', state: 'warn' },
    { label: 'Ceramide moisturiser', sub: 'Apply generously', state: 'todo' },
  ],
  suggested_fix: {
    title: 'Use PHA cleanser instead',
    message: 'Gluconolactone exfoliates gently, safe with retinol, and does not trigger rosacea pathways.',
  },
};

const MOCK_VERDICT_EVALUATE = {
  ...MOCK_EVALUATE,
  overall: 'avoid',
  compatibility_score: 24,
  hero_title: 'High risk for you personally',
  hero_subtitle: 'Salicylic acid conflicts with your retinol. Your rosacea makes this worse.',
};

function json(body, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

function verdictHistoryDays() {
  return [82, 88, 61, 74, 85, 91, 62, null].map((bfi, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (7 - i));
    return {
      date: d.toISOString().slice(0, 10),
      barrier_friction_index: bfi,
      overall: bfi == null ? null : bfi < 65 ? 'caution' : 'safe',
    };
  });
}

async function seedRedesignStorage(context, apiBase) {
  const spotCreated = new Date();
  spotCreated.setDate(spotCreated.getDate() - 18);
  await context.addInitScript(
    ({ api, sessionId, spotCreatedIso }) => {
      localStorage.setItem('patient_session_id', sessionId);
      localStorage.setItem('patient_session_email', 'e2e-redesign@example.com');
      localStorage.setItem('patient_api_base_url', api);
      localStorage.setItem('api_base', api);
      localStorage.setItem(
        'patient_journey_profile_v1',
        JSON.stringify({ modes: ['watch', 'routine'], primary: 'watch', chosenAt: new Date().toISOString() }),
      );
      localStorage.setItem(
        'patient_spots_v1',
        JSON.stringify([
          {
            id: 'spot_neck_1',
            label: 'Neck spot',
            bodyRegion: 'neck',
            createdAt: spotCreatedIso,
            photos: mockSpotSnapshots(),
          },
        ]),
      );
      localStorage.setItem('patient_spots_migrated_v1', '1');
    },
    { api: apiBase, sessionId: MOCK_SESSION_ID, spotCreatedIso: spotCreated.toISOString() },
  );
}

async function stubRedesignApis(page) {
  const pattern = /\/api\/(patient|public)\//;
  try {
    await page.unroute(pattern);
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
      return route.fulfill(
        json({
          success: true,
          profile: {
            journey_modes: ['watch', 'routine'],
            primary_mode: 'watch',
            onboarding_complete: true,
            bio_calibration_complete: true,
            needs_first_photo: false,
          },
        }),
      );
    }

    if (url.includes('/spots/') && url.includes('/timeline') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          timeline: {
            spot_id: 'spot_neck_1',
            label: 'Neck spot',
            body_region: 'neck',
            snapshots: mockSpotSnapshots(),
          },
        }),
      );
    }

    if (url.match(/\/spots\/[^/?]+$/) && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          spot: {
            id: 'spot_neck_1',
            label: 'Neck spot',
            body_region: 'neck',
            created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
            photos: mockSpotSnapshots(),
          },
        }),
      );
    }

    if (url.endsWith('/spots') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          spots: [
            {
              id: 'spot_neck_1',
              label: 'Neck spot',
              body_region: 'neck',
              created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
              photos: mockSpotSnapshots(),
            },
          ],
        }),
      );
    }

    if (url.includes('/routine/template')) {
      return route.fulfill(
        json({
          success: true,
          has_template: true,
          template: { name: 'Acne program', concern_id: 'acne' },
        }),
      );
    }

    if (url.includes('/routine/daily') && !url.includes('/photo')) {
      return route.fulfill(
        json({
          success: true,
          has_template: true,
          day_mode: 'today',
          allows_photo: true,
          daily_entry: { completion_score: 0, skin_report_parsed: null },
        }),
      );
    }

    if (url.includes('/routine/phase')) {
      return route.fulfill(
        json({
          success: true,
          has_template: true,
          phase: { program_week: 2, label: 'Week 2', expect: 'Calm inflammation', focus: 'Barrier repair' },
          items: [],
        }),
      );
    }

    if (url.includes('/routine/evaluate')) {
      return route.fulfill(json(MOCK_EVALUATE));
    }

    if (url.includes('/routine/verdict-history')) {
      return route.fulfill(json({ success: true, days: verdictHistoryDays() }));
    }

    if (url.includes('/home/progress-summary')) {
      return route.fulfill(
        json({
          success: true,
          summary: { streak_days: 14, baseline_skin_age: 32, latest_skin_age: 27 },
          improvement_metrics: { clarity_pct: 18, redness_pct: -34, skin_age_delta: -5, skin_age_years: -5 },
        }),
      );
    }

    if (url.includes('/home/next-actions')) {
      return route.fulfill(
        json({
          success: true,
          actions: [
            {
              type: 'barrier_recovery',
              title: 'Ease off actives tonight',
              message: 'Your barrier dropped recently — moisturizer first.',
              route: '/(tabs)/home',
              priority: 1,
            },
          ],
        }),
      );
    }

    if (url.includes('/home/barrier-insight')) {
      return route.fulfill(
        json({
          success: true,
          insight: {
            dip_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
            drop_points: 23,
            pattern_count: 3,
            title: 'Retinol + BHA same night',
            message:
              'Your barrier dropped 23 points the morning after. This pattern has appeared 3 times. Separate actives across nights.',
          },
        }),
      );
    }

    if (url.includes('/home/streak-percentile')) {
      return route.fulfill(json({ success: true, copy: 'Top 12% of users', percentile: 88 }));
    }

    if (url.includes('/journal/calendar-range')) {
      const days = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
          date: d.toISOString().slice(0, 10),
          has_media: i <= 2,
          thumbnail_url: i <= 2 ? PLACEHOLDER_URI : null,
          condition_tags: i === 0 ? ['calm'] : [],
          note: i === 0 ? 'Slept well' : null,
          completion_score: i <= 2 ? 100 : 0,
          verdict_overall: i === 1 ? 'caution' : 'safe',
          barrier_friction_index: [82, 88, 61, 74, 85, 91, 62, null][7 - i] ?? 75,
        });
      }
      return route.fulfill(json({ success: true, days }));
    }

    if (url.includes('/journal/timeline') && method === 'GET') {
      const days = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
          date: d.toISOString().slice(0, 10),
          photo_url: i <= 2 ? PLACEHOLDER_URI : null,
          thumbnail_url: i <= 2 ? PLACEHOLDER_URI : null,
          condition_tags: i === 0 ? ['calm'] : [],
          primary_condition: i === 0 ? 'Calm' : null,
          note: null,
          has_photo: i <= 2,
        });
      }
      return route.fulfill(json({ success: true, days }));
    }

    if (url.includes('/journal/trigger-insights')) {
      return route.fulfill(
        json({
          success: true,
          ready: true,
          entry_count: 12,
          insights: [
            {
              label: 'Dairy may trigger breakouts',
              body: 'Breakouts appeared after dairy-heavy meals in your notes.',
              confidence: 0.72,
              type: 'negative',
              keyword: 'dairy',
            },
          ],
        }),
      );
    }

    if (url.includes('/journal/improvements')) {
      return route.fulfill(
        json({
          success: true,
          ready: true,
          metrics: {
            redness_pct: -28,
            breakouts_pct: -36,
            texture_pct: 35,
            hydration_pct: 42,
          },
        }),
      );
    }

    if (url.includes('/journal/daily-photo') && method === 'POST') {
      const today = new Date().toISOString().slice(0, 10);
      return route.fulfill(
        json({
          success: true,
          entry_id: 'je_stub_1',
          entry_date: today,
          photo_url: PLACEHOLDER_URI,
          condition_tags: [],
          has_photo: true,
        }),
      );
    }

    if (url.includes('/journal/daily-entry') && method === 'PATCH') {
      const today = new Date().toISOString().slice(0, 10);
      return route.fulfill(
        json({
          success: true,
          entry_id: 'je_stub_1',
          entry_date: today,
          condition_tags: ['calm'],
          note: 'Test',
          has_photo: false,
        }),
      );
    }

    if (url.includes('/shelf/products/') && url.includes('/insight') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          feature_enabled: true,
          insight: {
            title: 'CeraVe Retinol Serum',
            message: 'Your barrier score is low — introduce actives slowly.',
            severity: 'caution',
            barrier_note: 'Barrier friction index: 62',
            skin_note: 'Profile conditions: rosacea',
          },
        }),
      );
    }

    if (url.includes('/shelf/products') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          products: [
            { id: MOCK_PRODUCT_ID, product_name: 'CeraVe Retinol Serum', usage_time: 'pm' },
            { id: 'shelf_niacinamide', product_name: 'The Ordinary Niacinamide', usage_time: 'am' },
            { id: 'shelf_spf', product_name: 'La Roche-Posay SPF 50', usage_time: 'am' },
          ],
        }),
      );
    }

    if (url.includes('/shelf/evaluate-pair')) {
      return route.fulfill(json({ ...MOCK_EVALUATE, ...MOCK_VERDICT_EVALUATE }));
    }

    if (url.includes('/verdict-action')) {
      return route.fulfill(json({ success: true, action: 'remove', evaluate: MOCK_EVALUATE }));
    }

    if (url.includes('/bio-profile')) {
      return route.fulfill(
        json({
          success: true,
          profile: { profile_complete: true, conditions: ['rosacea'], prescriptions: [] },
        }),
      );
    }

    if (url.includes('/billing/subscription')) {
      return route.fulfill(json({ success: true, subscription: { tier: 'free' } }));
    }

    if (url.includes('/features')) {
      return route.fulfill(json({ success: true, features: { wallet_enabled: false, chat_enabled: false } }));
    }

    if (url.includes('/goals') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          goals: [
            {
              id: 'goal_watch_1',
              goal_type: 'watch_spot',
              status: 'active',
              source: 'onboarding',
              target_ref: null,
            },
            {
              id: 'goal_routine_1',
              goal_type: 'improve_routine',
              status: 'active',
              source: 'onboarding',
              target_ref: null,
            },
          ],
        }),
      );
    }

    if (url.match(/\/goals\/[^/?]+$/) && method === 'PATCH') {
      return route.fulfill(
        json({
          success: true,
          goal: { id: 'goal_watch_1', goal_type: 'watch_spot', status: 'dismissed' },
        }),
      );
    }

    return route.fulfill(json({ success: true }));
  });
}

module.exports = {
  MOCK_PRODUCT_ID,
  MOCK_VERDICT_PRODUCT_ID,
  MOCK_SESSION_ID,
  MOCK_EVALUATE,
  seedRedesignStorage,
  stubRedesignApis,
};
