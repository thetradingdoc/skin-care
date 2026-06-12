'use strict';

const http = require('http');
const { test, expect } = require('@playwright/test');

const API_BASE = (process.env.PW_API_BASE || 'http://127.0.0.1:4000').replace(/\/$/, '');

function checkApi() {
  return new Promise((resolve) => {
    const url = new URL('/health/live', `${API_BASE}/`);
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

test.describe('live consumer journey', () => {
  test.beforeAll(async () => {
    if (process.env.LIVE_JOURNEY_SKIP === '1') return;
    const up = await checkApi();
    if (!up) test.skip(true, `Middleware not reachable at ${API_BASE}`);
  });

  test('health live', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health/live`);
    expect(res.ok()).toBeTruthy();
  });

  test('public concerns list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/public/routines/concerns`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.concerns)).toBe(true);
  });

  test('OTP verify send OPTIONS', async ({ request }) => {
    const res = await request.fetch(`${API_BASE}/api/patient/verify/send`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://myskinandcare.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status()).toBeLessThan(500);
  });

  test('funnel match POST', async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/public/funnel/match`, {
      data: {
        concern_scores: { acne: 2 },
        apparent_age_estimate: 30,
      },
    });
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBeTruthy();
    }
  });
});
