'use strict';

const { test, expect } = require('@playwright/test');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

const MOCK_PRODUCT_ID = 'shelf_e2e_retinol';
const MOCK_EVALUATE = {
  success: true,
  overall: 'caution',
  compatibility_score: 58,
  barrier_friction_index: 72,
  hero_title: 'Use with caution',
  hero_subtitle: 'Retinol 0.3% may clash with actives already on your shelf.',
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
  evidence_snippets: [{ id: 'ev-1', title: 'Retinol + BHA', body: 'Avoid same routine.' }],
};

async function stubConflictApis(page) {
  await page.route(/\/api\/patient\//, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/shelf/products/scan') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          product: { id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' },
          evaluate: MOCK_EVALUATE,
        }),
      });
    }

    if (url.includes('/shelf/evaluate-pair') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_EVALUATE, highlight_product_id: MOCK_PRODUCT_ID }),
      });
    }

    if (url.includes('/shelf/products') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          products: [{ id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' }],
        }),
      });
    }

    if (url.includes('/routine/evaluate')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_EVALUATE),
      });
    }

    if (url.includes('/shelf/products') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          product: { id: MOCK_PRODUCT_ID, product_name: 'Retinol 0.3%', usage_time: 'pm' },
        }),
      });
    }

    if (url.includes('/verdict-action') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, action: 'keep', evaluate: MOCK_EVALUATE }),
      });
    }

    if (url.includes('/bio-profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          profile: { conditions: ['acne'], prescriptions: [], profile_complete: true },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe('Conflict engine mobile wedge', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript((api) => {
      localStorage.setItem('patient_session_id', 'ps_e2e_conflict_engine');
      localStorage.setItem('patient_api_base_url', api);
      localStorage.setItem('api_base', api);
    }, API_BASE);
  });

  test('scan hub → verdict score → keep action', async ({ page }) => {
    await stubConflictApis(page);
    await page.goto('/app/(tabs)/scan', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Your products')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1 added')).toBeVisible();

    await page.goto(`/app/verdict/${MOCK_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('58')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/compatibility/i)).toBeVisible();
    await expect(page.getByText('Use with caution')).toBeVisible();

    const keepBtn = page.getByRole('button', { name: /keep anyway/i });
    await expect(keepBtn).toBeVisible();
    await keepBtn.click();
    await expect(page).toHaveURL(/\/app\/(\(tabs\)\/)?scan/, { timeout: 15_000 });
  });
});
