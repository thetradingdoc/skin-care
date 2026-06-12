'use strict';

const { test, expect } = require('@playwright/test');
const {
  uniqueStagingEmail,
  waitForEmailCodeFromStaging,
  stagingDbConfigured,
} = require('./helpers/staging-context.cjs');

const STAGING_API = (process.env.STAGING_API_BASE || 'https://api.callsomo.com').replace(/\/$/, '');
const LIVE = process.env.CONSUMER_STAGING_LIVE === '1';
const OTP_LIVE = process.env.STAGING_SMOKE_OTP === '1';
const describeLive = LIVE ? test.describe : test.describe.skip;
const describeOtpLive = LIVE && OTP_LIVE ? test.describe : test.describe.skip;

describeLive('staging consumer API smoke', () => {  test('health live', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/health/live`);
    expect(res.ok()).toBeTruthy();
  });

  test('public concerns list', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/api/public/routines/concerns`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.concerns)).toBe(true);
    expect(body.concerns.length).toBeGreaterThan(0);
  });

  test('CORS preflight for face-read', async ({ request }) => {
    const res = await request.fetch(`${STAGING_API}/api/public/face-read`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://myskinandcare.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status()).toBeLessThan(500);
    const allowOrigin = res.headers()['access-control-allow-origin'];
    expect(allowOrigin).toBeTruthy();
  });

  test('CORS preflight for OTP verify send', async ({ request }) => {
    const res = await request.fetch(`${STAGING_API}/api/patient/verify/send`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://myskinandcare.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.status()).toBeLessThan(500);
    const allowOrigin = res.headers()['access-control-allow-origin'];
    expect(allowOrigin).toBeTruthy();
  });

  test('funnel match POST accepts payload', async ({ request }) => {
    const res = await request.post(`${STAGING_API}/api/public/funnel/match`, {
      data: {
        concern_scores: { acne: 2, hyperpigmentation: 1 },
        apparent_age_estimate: 32,
      },
    });
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBeTruthy();
    }
  });
});

describeOtpLive('staging consumer OTP smoke (STAGING_SMOKE_OTP=1)', () => {
  test.beforeAll(() => {
    if (!stagingDbConfigured() && !process.env.STAGING_EMAIL_CODE) {
      test.skip(
        true,
        'Set STAGING_DB_PATH or STAGING_EMAIL_CODE for live OTP smoke',
      );
    }
  });

  test('send + confirm patient OTP on staging API', async ({ request }) => {
    const email = uniqueStagingEmail();

    const sendRes = await request.post(`${STAGING_API}/api/patient/verify/send`, {
      headers: { Origin: 'https://myskinandcare.com' },
      data: { email },
    });
    expect(sendRes.ok(), `OTP send failed: ${await sendRes.text()}`).toBeTruthy();
    const sendBody = await sendRes.json();
    expect(sendBody.success).toBeTruthy();
    expect(sendBody.session_id).toBeTruthy();

    const code = await waitForEmailCodeFromStaging(email);
    expect(code).toMatch(/^\d{6}$/);

    const confirmRes = await request.post(`${STAGING_API}/api/patient/verify/confirm`, {
      headers: { Origin: 'https://myskinandcare.com' },
      data: { email, code },
    });
    expect(confirmRes.ok(), `OTP confirm failed: ${await confirmRes.text()}`).toBeTruthy();
    const confirmBody = await confirmRes.json();
    expect(confirmBody.success).toBeTruthy();
  });
});