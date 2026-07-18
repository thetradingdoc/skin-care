#!/usr/bin/env node
'use strict';

/**
 * Authenticated production smoke: capture → confirm → calendar → progress → physician PDF.
 *
 * Confirm an already-emailed code (preferred — does not re-send):
 *   TOUCHE_PROD_OTP_EMAIL=you@x.com TOUCHE_PROD_OTP_CODE=123456 \
 *   TOUCHE_PROD_OTP_SESSION_ID=<session from send> \
 *     npm run smoke:touche-prod-e2e
 *
 * Send + confirm in one shot (only if you will use the NEW code from that send):
 *   TOUCHE_PROD_OTP_EMAIL=you@x.com TOUCHE_PROD_OTP_CODE=123456 \
 *   TOUCHE_PROD_OTP_SEND=1 npm run smoke:touche-prod-e2e
 *
 * Already verified session:
 *   TOUCHE_PROD_SESSION_ID=… npm run smoke:touche-prod-e2e
 */

const API_BASE = String(process.env.API_BASE || 'https://api.callsomo.com').replace(/\/$/, '');
const EMAIL = String(process.env.TOUCHE_PROD_OTP_EMAIL || '').trim();
const CODE = String(process.env.TOUCHE_PROD_OTP_CODE || '').trim();
const EXISTING_SESSION = String(process.env.TOUCHE_PROD_SESSION_ID || '').trim();
const OTP_SESSION = String(process.env.TOUCHE_PROD_OTP_SESSION_ID || '').trim();
const FORCE_SEND = process.env.TOUCHE_PROD_OTP_SEND === '1';
const SEND_ONLY = process.env.TOUCHE_PROD_OTP_SEND_ONLY === '1';

function minimalJpeg() {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
    'base64',
  );
}

async function http(method, path, { headers, body, timeoutMs } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs || 90000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* binary or non-json */
  }
  return { status: res.status, text, json, headers: res.headers };
}

function fail(step, detail) {
  console.error(`✗ FAIL [${step}] ${detail}`);
  process.exit(1);
}

function ok(step, detail) {
  console.log(`✓ PASS [${step}] ${detail}`);
}

async function main() {
  console.log(`Touche prod E2E smoke → ${API_BASE}\n`);
  let sessionId = EXISTING_SESSION;

  if (SEND_ONLY) {
    if (!EMAIL) fail('otp_send', 'TOUCHE_PROD_OTP_EMAIL required for SEND_ONLY');
    const send = await http('POST', '/api/patient/verify/send', {
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ToucheProdE2E/1.0' },
      body: JSON.stringify({ email: EMAIL }),
    });
    if (!(send.status === 200 && send.json?.success && send.json?.session_id)) {
      fail('otp_send', `HTTP ${send.status} ${JSON.stringify(send.json || send.text).slice(0, 200)}`);
    }
    console.log(`OTP sent to ${EMAIL}`);
    console.log(`TOUCHE_PROD_OTP_SESSION_ID=${send.json.session_id}`);
    console.log('Paste the 6-digit code from your inbox, then re-run with CODE + SESSION_ID (no SEND).');
    return;
  }

  if (!sessionId) {
    const codeLooksReal = CODE && !/^#+$/.test(CODE) && /^\d{4,8}$/.test(CODE);
    if (!EMAIL || !codeLooksReal) {
      fail(
        'auth',
        'Need a real 6-digit TOUCHE_PROD_OTP_CODE (not ######), plus TOUCHE_PROD_OTP_SESSION_ID from the matching send — or TOUCHE_PROD_SESSION_ID',
      );
    }

    let pendingSession = OTP_SESSION;
    if (FORCE_SEND || !pendingSession) {
      if (!FORCE_SEND && !pendingSession) {
        fail(
          'auth',
          'Set TOUCHE_PROD_OTP_SESSION_ID for the emailed code, or TOUCHE_PROD_OTP_SEND=1 to send a fresh code first',
        );
      }
      const send = await http('POST', '/api/patient/verify/send', {
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'ToucheProdE2E/1.0' },
        body: JSON.stringify({ email: EMAIL }),
      });
      if (!(send.status === 200 && send.json?.success && send.json?.session_id)) {
        fail('otp_send', `HTTP ${send.status} ${JSON.stringify(send.json || send.text).slice(0, 200)}`);
      }
      pendingSession = send.json.session_id;
      ok('otp_send', `session ${pendingSession}`);
    } else {
      ok('otp_session', `confirming against session ${pendingSession} (no re-send)`);
    }

    const confirm = await http('POST', '/api/patient/verify/confirm', {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ToucheProdE2E/1.0',
        'x-session-id': pendingSession,
      },
      body: JSON.stringify({ code: CODE, email: EMAIL }),
    });
    if (!(confirm.status === 200 && confirm.json?.success)) {
      fail('otp_confirm', `HTTP ${confirm.status} ${JSON.stringify(confirm.json || confirm.text).slice(0, 300)}`);
    }
    sessionId = confirm.json.session_id || pendingSession;
    ok('otp_confirm', `verified session ${sessionId}`);
  } else {
    ok('auth', `using existing session ${sessionId}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const form = new FormData();
  form.append('tag', 'other');
  form.append('ai_or_manual', 'manual');
  form.append('structured_json', JSON.stringify({ date: today, label: 'e2e-smoke-probe' }));
  form.append('request_id', `e2e-smoke-${Date.now()}`);
  form.append('file', new Blob([minimalJpeg()], { type: 'image/jpeg' }), 'e2e.jpg');

  const capture = await http('POST', '/api/patient/records/capture', {
    headers: { 'User-Agent': 'ToucheProdE2E/1.0', 'x-session-id': sessionId },
    body: form,
  });
  if (!(capture.status >= 200 && capture.status < 300 && capture.json?.success !== false && capture.json?.fact?.id)) {
    fail('capture', `HTTP ${capture.status} ${JSON.stringify(capture.json || capture.text).slice(0, 400)}`);
  }
  const factId = capture.json.fact.id;
  ok('capture', `fact ${factId} provider=${capture.json.fact.storage_provider}`);

  const confirmFact = await http('PATCH', `/api/patient/records/${encodeURIComponent(factId)}/confirm`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ToucheProdE2E/1.0',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({}),
  });
  if (!(confirmFact.status >= 200 && confirmFact.status < 300 && confirmFact.json?.success !== false)) {
    const post = await http('POST', `/api/patient/records/${encodeURIComponent(factId)}/confirm`, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ToucheProdE2E/1.0',
        'x-session-id': sessionId,
      },
      body: JSON.stringify({}),
    });
    if (!(post.status >= 200 && post.status < 300)) {
      fail(
        'confirm',
        `PATCH confirm HTTP ${confirmFact.status}; POST HTTP ${post.status} ${JSON.stringify(confirmFact.json || confirmFact.text).slice(0, 300)}`,
      );
    }
    ok('confirm', `POST confirm ok for ${factId}`);
  } else {
    ok('confirm', `confirmed ${factId}`);
  }

  const cal = await http('GET', `/api/patient/records/calendar?start=${today}&end=${today}`, {
    headers: { 'User-Agent': 'ToucheProdE2E/1.0', 'x-session-id': sessionId },
  });
  if (!(cal.status === 200 && cal.json)) {
    fail('calendar', `HTTP ${cal.status} ${JSON.stringify(cal.json || cal.text).slice(0, 300)}`);
  }
  const calBlob = JSON.stringify(cal.json);
  if (!calBlob.includes(factId) && !calBlob.includes('e2e-smoke-probe') && !calBlob.includes(today)) {
    fail('calendar', `response missing fact/date evidence: ${calBlob.slice(0, 400)}`);
  }
  ok('calendar', `HTTP 200 contains entry evidence`);

  const prog = await http('GET', '/api/patient/progress/aggregates', {
    headers: { 'User-Agent': 'ToucheProdE2E/1.0', 'x-session-id': sessionId },
  });
  if (!(prog.status === 200 && prog.json)) {
    fail('progress', `HTTP ${prog.status} ${JSON.stringify(prog.json || prog.text).slice(0, 300)}`);
  }
  ok('progress', `HTTP 200 keys=${Object.keys(prog.json).slice(0, 12).join(',')}`);

  const pdf = await http('GET', '/api/patient/export/physician.pdf', {
    headers: { 'User-Agent': 'ToucheProdE2E/1.0', 'x-session-id': sessionId },
  });
  const ctype = pdf.headers.get('content-type') || '';
  const looksPdf =
    pdf.status === 200 &&
    (ctype.includes('pdf') || pdf.text.startsWith('%PDF') || (pdf.json == null && pdf.text.length > 100));
  if (!looksPdf) {
    fail('physician_pdf', `HTTP ${pdf.status} ctype=${ctype} body=${String(pdf.text || '').slice(0, 200)}`);
  }
  ok('physician_pdf', `HTTP 200 ctype=${ctype || 'binary'} bytes≈${pdf.text.length}`);

  console.log('\nE2E SMOKE PASSED');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
