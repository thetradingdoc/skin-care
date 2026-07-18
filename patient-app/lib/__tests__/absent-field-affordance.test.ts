/**
 * Absent-field copy must not leak document-extraction language onto photo tags.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { absentFieldAffordance } from '@/lib/absent-field-affordance';

const ROOT = join(__dirname, '../..');

describe('absent field affordance — document vs photo', () => {
  it('skin/mark never say not found in document', () => {
    expect(absentFieldAffordance('skin', 'body_area')).toBe('which area is this? — tap to enter');
    expect(absentFieldAffordance('skin', 'note')).toBe('tap to enter');
    expect(absentFieldAffordance('mark', 'body_location')).toBe('where on the body? — tap to enter');
    expect(absentFieldAffordance('other', 'label')).toBe('tap to enter');
    for (const tag of ['skin', 'mark', 'other'] as const) {
      expect(absentFieldAffordance(tag, 'x')).not.toMatch(/document/i);
    }
  });

  it('document tags keep extraction absent copy', () => {
    expect(absentFieldAffordance('bill', 'provider')).toBe('not found in document — tap to enter');
    expect(absentFieldAffordance('prescription', 'od_sph')).toBe(
      'not found in document — tap to enter',
    );
    expect(absentFieldAffordance('lab', 'findings')).toBe('not found in document — tap to enter');
    expect(absentFieldAffordance('rx', 'drug')).toBe('not found in document — tap to enter');
  });

  it('skin confirm uses photo absent copy; affordance helper is tag-aware', () => {
    const skin = readFileSync(join(ROOT, 'app/capture/confirm/skin.tsx'), 'utf8');
    expect(skin).toMatch(/absentFieldAffordance/);
    expect(skin).toMatch(/confirm-skin-area-absent/);
    expect(skin).not.toMatch(/not found in document/);

    const mark = readFileSync(join(ROOT, 'app/capture/confirm/mark.tsx'), 'utf8');
    expect(mark).toMatch(/absentFieldAffordance/);
    expect(mark).not.toMatch(/not found in document/);

    const helper = readFileSync(join(ROOT, 'lib/absent-field-affordance.ts'), 'utf8');
    expect(helper).toMatch(/which area is this/);
    expect(helper).toMatch(/not found in document — tap to enter/);

    const form = readFileSync(join(ROOT, 'components/capture/TemplateFieldsForm.tsx'), 'utf8');
    expect(form).toMatch(/absentFieldAffordance/);
  });
});
