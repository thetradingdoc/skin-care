#!/usr/bin/env node
'use strict';

/**
 * Live smoke: patient OTP send must not claim success when email is not configured.
 *
 * Usage:
 *   node scripts/verify-patient-otp-email-live.cjs
 *   EMAIL=you@gmail.com API_BASE=https://api.callsomo.com node scripts/verify-patient-otp-email-live.cjs
 */

const API_BASE = (process.env.API_BASE || 'https://api.callsomo.com').replace(/\/$/, '');
const EMAIL = (process.env.EMAIL || 'otp-smoke@example.com').trim();
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function main() {
  console.log(`[otp-live] POST ${API_BASE}/api/patient/verify/send → ${EMAIL}`);

  const res = await fetch(`${API_BASE}/api/patient/verify/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': MOBILE_UA,
    },
    body: JSON.stringify({ email: EMAIL }),
  });

  const body = await res.json().catch(() => ({}));
  console.log(`[otp-live] status=${res.status} body=${JSON.stringify(body)}`);

  if (body.success === true) {
    console.log('✅ OTP API accepted — check inbox: From "Skin & Care", subject "Email verification"');
    process.exit(0);
  }

  if (res.status === 503 && /could not send email/i.test(String(body.error || ''))) {
    console.error('❌ Email delivery not configured on production middleware.');
    console.error('   Fix: set SMTP_HOST/SMTP_USER/SMTP_PASSWORD on Cloud Run (GCP Gmail SMTP).');
    console.error('   Run: bash scripts/configure-cloudrun-patient-email.sh');
    console.error('   Audit: bash scripts/audit-cloudrun-email-config.sh');
    process.exit(1);
  }

  console.error('❌ Unexpected OTP response');
  process.exit(1);
}

main().catch((e) => {
  console.error('[otp-live] FAILED:', e.message);
  process.exit(1);
});
