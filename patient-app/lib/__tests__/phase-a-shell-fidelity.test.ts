/**
 * Phase A — Progress T9-billonly, Profile AI meter, Language stub, Share doctor.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  progressShowsBillModule,
  progressShowsSkinModule,
  type ProgressModuleAggregates,
} from '@/lib/progress-module-visibility';

const APP = join(__dirname, '../../app');

describe('T9-billonly Progress — skin module hidden when no skin key', () => {
  it('bill-only aggregates omit skin; helpers match screen gating', () => {
    const billOnly: ProgressModuleAggregates = {
      bill: { fact_count: 2 },
    };
    expect(billOnly).not.toHaveProperty('skin');
    expect(progressShowsSkinModule(billOnly)).toBe(false);
    expect(progressShowsBillModule(billOnly)).toBe(true);

    const withSkin: ProgressModuleAggregates = {
      ...billOnly,
      skin: { fact_count: 5 },
    };
    expect(progressShowsSkinModule(withSkin)).toBe(true);
  });

  it('progress screen gates skin on progressShowsSkinModule', () => {
    const src = readFileSync(join(APP, '(tabs)/progress.tsx'), 'utf8');
    expect(src).toMatch(/progressShowsSkinModule\(aggregates\)/);
    expect(src).toMatch(/progress-module-skin/);
    expect(src).toMatch(/progressShowsBillModule\(aggregates\)/);
  });
});

describe('T10 Profile AI reads meter', () => {
  it('Profile loads GET /api/patient/ai/usage (mock T10 meter row)', () => {
    const src = readFileSync(join(APP, '(tabs)/account.tsx'), 'utf8');
    expect(src).toMatch(/\/api\/patient\/ai\/usage/);
    expect(src).toMatch(/profile-ai-reads-meter/);
    expect(src).toMatch(/profile-ai-reads-label/);
  });
});

describe('T11 Language honest stub', () => {
  it('English-only stub — no fake language picker', () => {
    const src = readFileSync(join(APP, 'profile/language.tsx'), 'utf8');
    expect(src).toMatch(/App language: English/);
    expect(src).toMatch(/more app languages coming/);
    expect(src).not.toMatch(/onPress.*setLanguage|Picker|i18n\.changeLanguage/);
    expect(src).not.toMatch(/Spanish|Français|Deutsch/);
  });
});

describe('T12 Share with doctor — real export APIs', () => {
  it('screen hits physician PDF + share-link endpoints (not fixtures)', () => {
    const src = readFileSync(join(APP, 'profile/share-with-doctor.tsx'), 'utf8');
    expect(src).toMatch(/SHARE_EXPORT_API = '\/api\/patient\/export\/physician\.pdf'/);
    expect(src).toMatch(/SHARE_LINK_API = '\/api\/patient\/export\/physician-share'/);
    expect(src).toMatch(/patientGet\(`\$\{SHARE_EXPORT_API\}/);
    expect(src).toMatch(/patientPost\(SHARE_LINK_API/);
    expect(src).not.toMatch(/fixture|mockPdf|hardcoded.*pdf/i);
  });
});
