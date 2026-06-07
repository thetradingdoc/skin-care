'use strict';

const SkinCareEmail = require('../lib/skin-care-email-layout');

describe('skin-care-email-layout', () => {
  test('layout includes logo and brand colors', () => {
    const html = SkinCareEmail.layout({
      title: 'Test',
      subtitle: 'Sub',
      bodyHtml: '<p>Hello</p>'
    });
    expect(html).toContain(SkinCareEmail.LOGO_URL);
    expect(html).toContain('#314db6');
    expect(html).toContain('Skin &amp; Care — your skin journal and care companion.');
    expect(html).not.toContain('DocLittle');
    expect(html).not.toMatch(/class="doc"/);
  });

  test('codeBox escapes html', () => {
    const html = SkinCareEmail.codeBox('<script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
