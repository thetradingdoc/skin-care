'use strict';

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

const MOCK_PRODUCT_ID = 'shelf_e2e_retinol';
const MOCK_SESSION_ID = 'ps_e2e_button_inventory';
const MOCK_EMAIL = 'inventory-e2e@example.com';

const MOCK_EVALUATE = {
  success: true,
  overall: 'caution',
  compatibility_score: 58,
  barrier_friction_index: 72,
  barrier_label: 'Stable',
  hero_title: 'Use with caution',
  hero_subtitle: 'Retinol 0.3% may clash with actives already on your shelf.',
  graph_unavailable: false,
  conflicts: [
    {
      ingredient_a: 'retinol',
      ingredient_b: 'salicylic acid',
      notes: 'Separate AM/PM',
    },
  ],
  product_statuses: [
    {
      shelf_product_id: MOCK_PRODUCT_ID,
      product_name: 'Retinol 0.3%',
      status: 'conflict',
      usage_time: 'pm',
    },
  ],
  routine_step_states: [
    { label: 'Gentle cleanser', sub: 'pH 5.5 · safe', state: 'done' },
    { label: 'Retinol 0.3%', sub: 'Ingredient conflict detected', state: 'warn' },
  ],
  evidence_snippets: [{ id: 'ev-1', title: 'Retinol + BHA', body: 'Avoid same routine.' }],
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function json(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function calendarDays(start, end) {
  const days = [];
  const cur = new Date(`${start}T12:00:00.000Z`);
  const endD = new Date(`${end}T12:00:00.000Z`);
  while (cur <= endD) {
    const date = cur.toISOString().slice(0, 10);
    days.push({
      date,
      has_media: date === todayIso(),
      completion_score: date === todayIso() ? 0 : 100,
      verdict_overall: 'safe',
      barrier_friction_index: 75,
      thumbnail_url: null,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

async function bootstrapMobileSession(context, opts = {}) {
  const sessionId = opts.sessionId || MOCK_SESSION_ID;
  const email = opts.email || MOCK_EMAIL;
  const journeyModes = opts.journeyModes; // undefined = leave alone; [] = clear; ['routine'] = set
  const withSpot = !!opts.withSpot;
  await context.addInitScript(
    ({ api, sid, em, journeyModes, withSpot, clearSpots }) => {
      localStorage.setItem('patient_session_id', sid);
      localStorage.setItem('patient_api_base_url', api);
      localStorage.setItem('api_base', api);
      localStorage.setItem('patient_session_email', em);
      if (Array.isArray(journeyModes)) {
        if (journeyModes.length) {
          localStorage.setItem(
            'patient_journey_profile_v1',
            JSON.stringify({
              modes: journeyModes,
              primary: journeyModes[0],
              chosenAt: new Date().toISOString(),
            }),
          );
        } else {
          localStorage.removeItem('patient_journey_profile_v1');
        }
      }
      if (withSpot) {
        localStorage.setItem(
          'patient_spots_v1',
          JSON.stringify([
            {
              id: 'spot_neck_1',
              label: 'Neck spot',
              bodyRegion: 'neck',
              createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
              photos: [{ date: '2026-06-01' }],
            },
          ]),
        );
        localStorage.setItem('patient_spots_migrated_v1', '1');
      } else if (clearSpots) {
        localStorage.removeItem('patient_spots_v1');
      }
    },
    { api: API_BASE, sid: sessionId, em: email, journeyModes, withSpot, clearSpots: !!opts.clearSpots },
  );
}

const API_ROUTE_PATTERN = /\/api\/(patient|public)\//;

async function stubMobileAppApis(page, opts = {}) {
  const emptyBilling = !!opts.emptyBilling;
  const meMode = opts.meMode || 'ok'; // ok | auth_dead | network_fail | hang
  const journeyModes = opts.journeyModes; // undefined → default routine+watch complete
  const hasTemplate = opts.hasTemplate !== false;
  const bioComplete = opts.bioComplete !== false;
  const emptyShelf = !!opts.emptyShelf;
  const allowsPhoto = opts.allowsPhoto !== false;
  const hangMs = Number(opts.hangMs || 8000);

  try {
    await page.unroute(API_ROUTE_PATTERN);
  } catch {
    /* first stub on this page */
  }
  await page.route(API_ROUTE_PATTERN, async (route) => {
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

    if (url.includes('/verify/send') && method === 'POST') {
      return route.fulfill(json({ success: true, session_id: MOCK_SESSION_ID, message: 'Code sent' }));
    }
    if (url.includes('/verify/confirm') && method === 'POST') {
      return route.fulfill(
        json({
          success: true,
          session_id: MOCK_SESSION_ID,
          patient_id: 'patient-e2e',
          email: MOCK_EMAIL,
        })
      );
    }

    if (url.includes('/me')) {
      if (meMode === 'hang') {
        await new Promise((r) => setTimeout(r, hangMs));
        return route.fulfill(json({ success: true, patient: { email: MOCK_EMAIL, id: 'patient-e2e' } }));
      }
      if (meMode === 'auth_dead') {
        return route.fulfill(json({ success: false, error: 'Sign in required.' }, 401));
      }
      if (meMode === 'network_fail') {
        return route.abort('failed');
      }
      return route.fulfill(json({ success: true, patient: { email: MOCK_EMAIL, id: 'patient-e2e' } }));
    }

    if (url.includes('/consumer-profile')) {
      const modes =
        Array.isArray(journeyModes) ? journeyModes : ['watch', 'routine'];
      return route.fulfill(
        json({
          success: true,
          profile: {
            journey_modes: modes,
            primary_mode: modes[0] || null,
            onboarding_complete: modes.length > 0,
            bio_calibration_complete: bioComplete,
            needs_first_photo: false,
          },
        }),
      );
    }

    if (url.includes('/shelf/products/scan') && method === 'POST') {
      return route.fulfill(
        json({
          success: true,
          product: { id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' },
          evaluate: MOCK_EVALUATE,
        })
      );
    }
    if (url.includes('/shelf/evaluate-pair') && method === 'POST') {
      return route.fulfill(json({ ...MOCK_EVALUATE, highlight_product_id: MOCK_PRODUCT_ID }));
    }
    if (url.includes('/shelf/products') && method === 'GET') {
      return route.fulfill(
        json({
          success: true,
          products: emptyShelf
            ? []
            : [{ id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' }],
        })
      );
    }
    if (url.includes('/shelf/products') && method === 'POST') {
      return route.fulfill(
        json({
          success: true,
          product: { id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' },
        })
      );
    }
    if (url.includes('/verdict-action') && method === 'POST') {
      return route.fulfill(json({ success: true, action: 'keep', evaluate: MOCK_EVALUATE }));
    }
    if (url.includes('/routine/evaluate')) {
      return route.fulfill(json(MOCK_EVALUATE));
    }
    if (url.includes('/bio-profile')) {
      if (method === 'GET') {
        return route.fulfill(
          json({
            success: true,
            profile: bioComplete
              ? { conditions: ['acne'], prescriptions: [], profile_complete: true }
              : { conditions: [], prescriptions: [], profile_complete: false },
          })
        );
      }
      return route.fulfill(json({ success: true }));
    }

    if (url.includes('/routine/template')) {
      if (method === 'POST') {
        return route.fulfill(json({ success: true, has_template: true, template: { id: 'tpl-1', name: 'Acne care plan' } }));
      }
      if (!hasTemplate) {
        return route.fulfill(json({ success: true, has_template: false }));
      }
      return route.fulfill(
        json({
          success: true,
          has_template: true,
          template: {
            id: 'tpl-1',
            name: 'Acne care plan',
            items: [
              { product_name: 'Gentle cleanser', usage_time: 'am', goal: 'Cleanse' },
              { product_name: 'Retinol 0.3%', usage_time: 'pm', goal: 'Treat' },
            ],
          },
        })
      );
    }

    if (url.includes('/lineup-preview')) {
      return route.fulfill(
        json({
          success: true,
          date: todayIso(),
          preview: { overall: 'safe', conflict_count: 0, barrier_friction_index: 85 },
        })
      );
    }

    if (url.includes('/routine/daily')) {
      return route.fulfill(
        json({
          success: true,
          day_mode: allowsPhoto ? 'today' : 'past_readonly',
          allows_photo: allowsPhoto,
          daily_entry: { completion_score: 0, skin_report_parsed: null },
        })
      );
    }

    if (url.includes('/routine/phase')) {
      return route.fulfill(
        json({
          success: true,
          has_template: hasTemplate,
          day_mode: allowsPhoto ? 'today' : 'past_readonly',
          allows_photo: allowsPhoto,
          phase: {
            program_week: 2,
            total_weeks: 12,
            label: 'Building consistency',
            expect: 'Mild dryness possible.',
            focus: 'Barrier support',
            notes: 'Stay consistent with SPF.',
            red_flags: ['Severe swelling', 'Open wounds'],
          },
          items: [
            { product_name: 'Gentle cleanser', usage_time: 'am', goal: 'Cleanse' },
            { product_name: 'Retinol 0.3%', usage_time: 'pm', goal: 'Treat' },
          ],
        })
      );
    }

    if (url.includes('/home/progress-summary')) {
      return route.fulfill(
        json({
          success: true,
          summary: { streak_days: 3, baseline_skin_age: 32, latest_skin_age: 31 },
          improvement_metrics: { clarity_pct: 12, redness_pct: -5, skin_age_delta: -1 },
        })
      );
    }

    if (url.includes('/journal/calendar-range')) {
      const u = new URL(url);
      const start = u.searchParams.get('start') || '2026-01-01';
      const end = u.searchParams.get('end') || todayIso();
      return route.fulfill(json({ success: true, days: calendarDays(start, end) }));
    }

    if (url.includes('/home/barrier-insight')) {
      return route.fulfill(json({ success: true, insight: null }));
    }

    if (url.includes('/billing/subscription')) {
      return route.fulfill(
        json({
          success: true,
          subscription: { tier: 'free', status: 'inactive' },
          pricing_policy: { care_program: { monthly_price_cents: 999, currency: 'usd', description: 'Care program' } },
        })
      );
    }

    if (url.includes('/billing/care-program/checkout') && method === 'POST') {
      return route.fulfill(
        json({ success: true, checkout_url: 'https://checkout.stripe.com/e2e-mock-session' })
      );
    }

    if (url.includes('/features')) {
      return route.fulfill(json({ success: true, features: { wallet_enabled: true } }));
    }

    if (url.includes('/billing/money-summary')) {
      return route.fulfill(
        json({
          success: true,
          summary: { total_due_cents: 0, upcoming_count: 0, captured_count: 2 },
        })
      );
    }

    if (url.includes('/billing/events')) {
      if (emptyBilling) {
        return route.fulfill(json({ success: true, events: [] }));
      }
      return route.fulfill(
        json({
          success: true,
          events: [
            {
              id: 'evt-1',
              title: 'Dermatology visit',
              status: 'due',
              amount_cents: 5000,
              due_date: todayIso(),
            },
          ],
        })
      );
    }

    if (url.includes('/billing/documents')) {
      return route.fulfill(
        json({
          success: true,
          documents: [{ id: 'doc-1', file_name: 'eob.pdf', created_at: todayIso(), status: 'available' }],
        })
      );
    }

    if (url.includes('/support-config')) {
      return route.fulfill(json({ success: true, support_email: 'help@example.com' }));
    }

    if (url.includes('/billing/retention-policy')) {
      if (method === 'GET') {
        return route.fulfill(json({ success: true, policy: { retention_days: 365, auto_delete: false } }));
      }
      return route.fulfill(json({ success: true }));
    }

    if (url.includes('/billing/data-deletion-request') && method === 'POST') {
      return route.fulfill(json({ success: true, request_id: 'del-req-1' }));
    }

    if (url.includes('/appointments')) {
      return route.fulfill(
        json({
          success: true,
          appointments: [
            {
              id: 'appt-1',
              provider_name: 'Dr. Smith',
              scheduled_at: `${todayIso()}T15:00:00.000Z`,
              visit_type: 'video',
              join_url: 'https://example.com/join',
            },
          ],
        })
      );
    }

    if (url.includes('/intake')) {
      return route.fulfill(
        json({
          success: true,
          intake: { first_name: 'Test', last_name: 'Patient', email: MOCK_EMAIL },
        })
      );
    }

    if (url.includes('/public/commerce/quote') || url.includes('/public/checkout/start')) {
      return route.fulfill(json({ success: true, quote: { total_cents: 4999 }, checkout_url: 'https://checkout.stripe.com/e2e' }));
    }

    if (url.includes('/checkout-chat/turn')) {
      return route.fulfill(json({ success: true, reply: 'Thanks for your question.' }));
    }

    if (url.includes('/public/routines/concerns')) {
      return route.fulfill(
        json({
          success: true,
          concerns: [
            { id: 'acne', label: 'Acne care plan', total_weeks: 12 },
            { id: 'anti_aging', label: 'Anti-aging care plan', total_weeks: 12 },
          ],
        })
      );
    }

    if (url.includes('/public/routines/') && url.includes('/preview')) {
      return route.fulfill(
        json({
          success: true,
          preview: { key_rules: ['Use SPF daily', 'Patch test new products'] },
        })
      );
    }

    if (url.includes('/public/funnel/match')) {
      return route.fulfill(
        json({ success: true, match: { primary_suggestion: 'acne', route: 'track_program' } })
      );
    }

    if (url.includes('/public/face-read')) {
      return route.fulfill(
        json({
          success: true,
          face_read: { apparent_age_estimate: 34, quality: 'ok', findings: [], concern_scores: {} },
        })
      );
    }

    return route.fulfill(json({ success: true }));
  });
}

module.exports = {
  API_BASE,
  MOCK_PRODUCT_ID,
  MOCK_SESSION_ID,
  MOCK_EMAIL,
  MOCK_EVALUATE,
  bootstrapMobileSession,
  stubMobileAppApis,
};
