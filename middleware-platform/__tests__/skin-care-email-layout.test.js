'use strict';

const SkinCareEmail = require('../lib/skin-care-email-layout');

describe('skin-care-email-layout', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  test('layout includes composite email wordmark and consumer brand colors', () => {
    delete process.env.SKIN_CARE_EMAIL_LOGO_URL;
    delete process.env.SOMO_EMAIL_LOGO_URL;
    delete process.env.SOMO_EMAIL_LOGO;
    delete process.env.SKIN_CARE_EMAIL_WORDMARK_MODE;
    delete process.env.SKIN_CARE_EMAIL_SUPPORT;
    delete process.env.SOMO_EMAIL_SUPPORT;

    const html = SkinCareEmail.layout({
      title: 'Test',
      subtitle: 'Sub',
      bodyHtml: '<p>Hello</p>'
    });
    expect(html).toContain(SkinCareEmail.EMAIL_WORDMARK_URL);
    expect(html).toContain('email-wordmark.png');
    expect(html).toContain('email-wordmark@2x.png');
    expect(html).not.toContain('logo-wordmark.png');
    expect(html).not.toMatch(/tulip-mark\.png[^@]*width="2[0-9]"/);
    expect(html).toContain('#314db6');
    expect(html).toContain(SkinCareEmail.FOOTER_TAGLINE);
    expect(html).toContain('myskinandcare.com');
    expect(html).not.toContain('DocLittle');
    expect(html).not.toMatch(/class="doc"/);
    expect(html).not.toContain('linear-gradient');
    expect(html).not.toContain('info@callsomo.com');
    expect(html).toContain('fonts.googleapis.com');
    expect(html).toContain('Gloock');
  });

  test('layout uses custom logo image when SKIN_CARE_EMAIL_LOGO_URL is set', () => {
    process.env.SKIN_CARE_EMAIL_LOGO_URL = 'https://example.com/custom-logo.png';
    const html = SkinCareEmail.layout({
      title: 'Test',
      bodyHtml: '<p>Hello</p>'
    });
    expect(html).toContain('https://example.com/custom-logo.png');
    expect(html).not.toContain('email-wordmark.png');
  });

  test('footer shows support email only when SKIN_CARE_EMAIL_SUPPORT is set', () => {
    process.env.SKIN_CARE_EMAIL_SUPPORT = 'help@myskinandcare.com';
    const html = SkinCareEmail.layout({
      title: 'Test',
      bodyHtml: '<p>Hello</p>'
    });
    expect(html).toContain('help@myskinandcare.com');
  });

  test('codeBox escapes html and uses consumer styling', () => {
    const html = SkinCareEmail.codeBox('<script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('sc-code-box');
    expect(html).not.toContain('Courier');
  });

  test('emailWordmarkImg includes srcset for retina', () => {
    const html = SkinCareEmail.emailWordmarkImg();
    expect(html).toContain('srcset=');
    expect(html).toContain(SkinCareEmail.EMAIL_WORDMARK_URL_2X);
  });
});
