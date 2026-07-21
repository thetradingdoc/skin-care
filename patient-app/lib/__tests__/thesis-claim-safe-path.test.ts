/**
 * Step 20 — Thesis claim-safe path gate.
 * Thesis must NOT read concern-routines.json / claim-safe preview API.
 * Plan Preview uses buildClaimSafePreview; Thesis skin is FE-owned approved constants.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../..');
const THESIS_SKIN = join(ROOT, 'app/capture/thesis/skin.tsx');
const PLAN_PREVIEW = join(ROOT, 'app/onboarding/plan-preview.tsx');

describe('Step 20 Thesis vs Plan Preview claim-safe paths', () => {
  it('Thesis skin does not fetch routines / claim-safe preview / concern JSON', () => {
    const src = readFileSync(THESIS_SKIN, 'utf8');
    // Strip comments so docstrings naming "claim-safe" don't false-fail.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/concern-routines/);
    expect(code).not.toMatch(/claim_safe|preview\/claim-safe/);
    expect(code).not.toMatch(/\/api\/public\/routines/);
    expect(code).not.toMatch(/buildClaimSafePreview|buildPreview/);
    expect(code).not.toMatch(/patientGet|patientPost|\bfetch\s*\(/);
    expect(src).toMatch(/THESIS_SKIN_HONESTY/);
    expect(src).toMatch(/Habits, not promises/);
    expect(src).toMatch(/No timeline is promised/);
    expect(src).toMatch(/SPF matters here/);
    expect(src).toMatch(/Log weekly, same light/);
  });

  it('Plan Preview is a separate path that does call claim-safe preview', () => {
    const src = readFileSync(PLAN_PREVIEW, 'utf8');
    expect(src).toMatch(/claim-safe|claim_safe|preview\/claim-safe/);
  });
});
