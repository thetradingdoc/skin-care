'use strict';

const {
  formatSmtpFrom,
  smtpFromAddress,
  EMAIL_SUBJECT_VERIFICATION
} = require('../services/email-service');
const SkinCareEmail = require('../lib/skin-care-email-layout');

describe('email-service from formatting', () => {
  test('formatSmtpFrom wraps bare address with Skin & Care display name', () => {
    expect(formatSmtpFrom('richard@callsomo.com')).toBe('Skin & Care <richard@callsomo.com>');
  });

  test('formatSmtpFrom preserves existing display name', () => {
    expect(formatSmtpFrom('Custom <noreply@example.com>')).toBe('Custom <noreply@example.com>');
  });

  test('formatSmtpFrom defaults when empty', () => {
    expect(formatSmtpFrom('')).toBe('Skin & Care <info@callsomo.com>');
  });

  test('smtpFromAddress extracts bare email', () => {
    expect(smtpFromAddress('richard@callsomo.com')).toBe('richard@callsomo.com');
    expect(smtpFromAddress('Skin & Care <richard@callsomo.com>')).toBe('richard@callsomo.com');
  });
});

describe('verification email layout', () => {
  test('preheader does not include OTP code digits', () => {
    const code = '366721';
    const html = SkinCareEmail.layout({
      title: EMAIL_SUBJECT_VERIFICATION,
      bodyHtml: SkinCareEmail.codeBox(code),
      preheader: 'Your one-time sign-in code is inside this email.'
    });
    expect(html).toContain(code);
    expect(html).toContain('Your one-time sign-in code is inside this email.');
    expect(html).not.toMatch(/preheader[^]*Code:\s*366721/i);
  });
});
