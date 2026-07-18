'use strict';

/**
 * APP-04 — confirm + manual screens must use TemplateFieldsForm (catalog SSOT).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../patient-app');

describe('APP-04 template confirm/manual migration', () => {
  const confirmFiles = ['skin', 'bill', 'mark', 'other', 'rx', 'lab'];

  test.each(confirmFiles)('confirm/%s.tsx imports TemplateFieldsForm', (name) => {
    const src = fs.readFileSync(
      path.join(ROOT, `app/capture/confirm/${name}.tsx`),
      'utf8',
    );
    expect(src).toMatch(/TemplateFieldsForm/);
    expect(src).toMatch(/getTemplateForDraft/);
    // Adversarial: no leftover hardcoded ConfirmEditableField Date/Area pairs for skin/mark/other/bill
    if (['skin', 'mark', 'other', 'bill'].includes(name)) {
      expect(src).not.toMatch(/ConfirmEditableField/);
    }
  });

  test('manual-entry resolves skin/mark/other templates', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/capture/manual-entry.tsx'), 'utf8');
    expect(src).toMatch(/getTemplate\('skin\.default'\)/);
    expect(src).toMatch(/getTemplate\('mark\.default'\)/);
    expect(src).toMatch(/getTemplate\('other\.default'\)/);
    expect(src).toMatch(/getTemplate\('bill\.default'\)/);
  });
});
