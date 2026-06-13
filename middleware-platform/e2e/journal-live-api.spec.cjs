'use strict';

const { test, expect } = require('@playwright/test');
const {
  uniqueStagingEmail,
  waitForEmailCodeFromStaging,
  stagingDbConfigured,
} = require('./helpers/staging-context.cjs');

const STAGING_API = (process.env.STAGING_API_BASE || 'https://api.callsomo.com').replace(/\/$/, '');
const LIVE = process.env.CONSUMER_STAGING_LIVE === '1';
const describeLive = LIVE ? test.describe : test.describe.skip;

async function createPatientSession(request) {
  const preset = String(process.env.JOURNAL_LIVE_SESSION_ID || '').trim();
  if (preset) return preset;

  if (!stagingDbConfigured() && !process.env.STAGING_EMAIL_CODE) {
    throw new Error(
      'Set JOURNAL_LIVE_SESSION_ID, STAGING_DB_PATH, or STAGING_EMAIL_CODE for live journal API smoke',
    );
  }

  const email = uniqueStagingEmail();
  const sendRes = await request.post(`${STAGING_API}/api/patient/verify/send`, {
    headers: { Origin: 'https://myskinandcare.com', 'Content-Type': 'application/json' },
    data: { email },
  });
  expect(sendRes.ok(), `OTP send failed: ${await sendRes.text()}`).toBeTruthy();

  const code = await waitForEmailCodeFromStaging(email);
  expect(code).toMatch(/^\d{6}$/);

  const confirmRes = await request.post(`${STAGING_API}/api/patient/verify/confirm`, {
    headers: { Origin: 'https://myskinandcare.com', 'Content-Type': 'application/json' },
    data: { email, code },
  });
  expect(confirmRes.ok(), `OTP confirm failed: ${await confirmRes.text()}`).toBeTruthy();
  const confirmBody = await confirmRes.json();
  expect(confirmBody.success).toBeTruthy();
  expect(confirmBody.session_id).toBeTruthy();
  return confirmBody.session_id;
}

function journalHeaders(sessionId) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    Origin: 'https://myskinandcare.com',
    'Content-Type': 'application/json',
    'x-session-id': sessionId,
    'x-client-date': today,
  };
}

describeLive('journal live API smoke', () => {
  let sessionId;

  test.beforeAll(async ({ request }) => {
    sessionId = await createPatientSession(request);
  });

  test('GET trigger-insights is enabled (not JOURNAL_MODE_DISABLED)', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/api/patient/journal/trigger-insights`, {
      headers: journalHeaders(sessionId),
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).not.toBe(503);
    expect(body.error_code, JSON.stringify(body)).not.toBe('JOURNAL_MODE_DISABLED');
    expect(body.success).toBeTruthy();
  });

  test('PATCH daily-entry saves check-in', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request.patch(`${STAGING_API}/api/patient/journal/daily-entry`, {
      headers: journalHeaders(sessionId),
      data: {
        entry_date: today,
        condition_tags: ['calm'],
        note: 'Live journal API smoke',
      },
    });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.success).toBeTruthy();
    expect(body.entry_date).toBe(today);
    expect(Array.isArray(body.condition_tags)).toBeTruthy();
  });

  test('GET improvements returns success payload', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/api/patient/journal/improvements`, {
      headers: journalHeaders(sessionId),
    });
    const body = await res.json();
    expect(res.status(), JSON.stringify(body)).not.toBe(503);
    expect(body.success).toBeTruthy();
    expect(typeof body.ready).toBe('boolean');
  });

  test('GET timeline returns days array', async ({ request }) => {
    const res = await request.get(`${STAGING_API}/api/patient/journal/timeline?days=8`, {
      headers: journalHeaders(sessionId),
    });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.success).toBeTruthy();
    expect(Array.isArray(body.days)).toBeTruthy();
  });
});
