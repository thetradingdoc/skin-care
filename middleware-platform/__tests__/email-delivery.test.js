'use strict';

const EmailService = require('../services/email-service');

describe('EmailService delivery configuration', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('returns failure in production when no Azure/SMTP (no fake success)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    const result = await EmailService.sendEmail({
      to: 'patient@example.com',
      subject: 'Test',
      html: '<p>code</p>',
    });

    expect(result.success).toBe(false);
    expect(result.provider).toBe('console');
    expect(result.error).toBe('email_delivery_not_configured');
  });

  it('allows simulated console success in development', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.RCM_E2E_RECORD_EMAIL;

    const result = await EmailService.sendEmail({
      to: 'patient@example.com',
      subject: 'Test',
      html: '<p>code</p>',
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('console');
  });

  it('isDeliveryConfigured is false without SMTP or Azure', () => {
    delete process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    expect(EmailService.isDeliveryConfigured()).toBe(false);
  });
});
