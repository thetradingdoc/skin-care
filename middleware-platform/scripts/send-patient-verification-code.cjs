/* eslint-disable no-console */
require('dotenv').config();

/**
 * Send a real patient portal OTP email (same path as /api/patient/verify/send).
 *
 * Usage:
 *   EMAIL=drlittlekids@gmail.com node scripts/send-patient-verification-code.cjs
 */
const PatientPortalService = require('../services/patient-portal-service');

async function main() {
  const email = String(process.env.EMAIL || '').trim();
  if (!email) throw new Error('Set EMAIL=someone@example.com');

  console.log('[patient-otp] target:', email);
  console.log('[patient-otp] EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER || 'smtp');
  console.log(
    '[patient-otp] SMTP:',
    !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  );
  console.log('[patient-otp] delivery configured:', require('../services/email-service').isDeliveryConfigured());

  const result = await PatientPortalService.sendVerificationCode(email, {
    ip: '127.0.0.1',
    userAgent: 'send-patient-verification-code.cjs',
  });

  console.log('[patient-otp] result:', result);
  if (!result?.success) process.exitCode = 1;
}

main().catch((e) => {
  console.error('[patient-otp] FAILED:', e.message);
  process.exitCode = 1;
});
