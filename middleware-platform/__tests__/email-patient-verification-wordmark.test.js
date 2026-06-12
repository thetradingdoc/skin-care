'use strict';

const mockSendMail = jest.fn(async () => ({ messageId: 'test-message-id' }));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

const EmailService = require('../services/email-service');
const SkinCareEmail = require('../lib/skin-care-email-layout');

describe('sendPatientVerificationCode wordmark attachment', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    mockSendMail.mockClear();
    process.env = {
      ...envBackup,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'noreply@example.com',
      SMTP_PASSWORD: 'secret',
      NODE_ENV: 'test',
    };
    delete process.env.SKIN_CARE_EMAIL_LOGO_URL;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test('includes CID wordmark attachment in verification email when PNG is available', async () => {
    const wordmarkPath = SkinCareEmail.resolveEmailWordmarkPath();
    if (!wordmarkPath) {
      console.warn('skip: email-wordmark.png not on disk');
      return;
    }

    await EmailService.sendPatientVerificationCode('patient@example.com', '123456');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.html).toContain(`cid:${SkinCareEmail.EMAIL_WORDMARK_CID}`);
    expect(mailOptions.html).not.toContain('data:image/png;base64,');
    expect(mailOptions.html).not.toContain('alt="skin care"');
    expect(mailOptions.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cid: SkinCareEmail.EMAIL_WORDMARK_CID,
          path: wordmarkPath,
          contentDisposition: 'inline',
        }),
      ]),
    );
  });
});
