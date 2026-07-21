/**
 * P7.04–P7.08 — Capture routing, confirm field sets, thesis×6, daily AI SUGGESTS, Shelf Buy vs Rx.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  CAPTURE_FLOW_STEPS,
  hrefForCaptureStep,
  mapCaptureTagChip,
  nextCaptureStep,
} from '@/lib/capture-state-machine';
import { SHELF_RX_NEVER_BUY } from '@/lib/shelf-commerce-cta';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');
const CONFIRM = join(APP, 'capture/confirm');
const THESIS = join(APP, 'capture/thesis');

describe('P7.04 Capture state machine 2a→3→4→5→5b→6', () => {
  it('locks the six-step path and routes per tag', () => {
    expect([...CAPTURE_FLOW_STEPS]).toEqual(['2a', '3', '4', '5', '5b', '6']);
    expect(nextCaptureStep('2a')).toBe('3');
    expect(nextCaptureStep('3')).toBe('4');
    expect(nextCaptureStep('4')).toBe('5');
    expect(nextCaptureStep('5')).toBe('5b');
    expect(nextCaptureStep('5b')).toBe('6');
    expect(nextCaptureStep('6')).toBeNull();

    expect(String(hrefForCaptureStep('2a'))).toBe('/capture');
    expect(String(hrefForCaptureStep('3'))).toBe('/capture/tag');
    expect(String(hrefForCaptureStep('4', 'bill'))).toContain('/capture/loading');
    expect(String(hrefForCaptureStep('5', 'rx'))).toBe('/capture/confirm/rx');
    expect(String(hrefForCaptureStep('5b', 'lab'))).toBe('/capture/reveal/lab');
    expect(String(hrefForCaptureStep('6', 'mark'))).toBe('/capture/thesis/mark');
    expect(mapCaptureTagChip('prescription')).toBe('rx');
  });

  it('UIs exist for all six tags at confirm / reveal / thesis', () => {
    for (const tag of ['skin', 'bill', 'rx', 'mark', 'lab', 'other'] as const) {
      expect(existsSync(join(CONFIRM, `${tag}.tsx`)), `confirm ${tag}`).toBe(true);
      expect(existsSync(join(APP, `capture/reveal/${tag}.tsx`)), `reveal ${tag}`).toBe(true);
      expect(existsSync(join(THESIS, `${tag}.tsx`)), `thesis ${tag}`).toBe(true);
    }
    expect(existsSync(join(APP, 'capture/index.tsx'))).toBe(true);
    expect(existsSync(join(APP, 'capture/tag.tsx'))).toBe(true);
    expect(existsSync(join(APP, 'capture/loading.tsx'))).toBe(true);

    const tag = readFileSync(join(APP, 'capture/tag.tsx'), 'utf8');
    expect(tag).toMatch(/CAPTURE_LOADING_HREF/);
    expect(tag).toMatch(/capture-3-tag/);

    const loading = readFileSync(join(APP, 'capture/loading.tsx'), 'utf8');
    expect(loading).toMatch(/capture-4-loading/);
    expect(loading).toMatch(/runAiCaptureOrchestration/);
    expect(loading).not.toMatch(/setTimeout/);
  });
});

describe('P7.05 Confirm UI field sets (v10 — not Date+Area×6)', () => {
  it('bill has amount/provider/currency; rx drug/strength/expiry; lab language row', () => {
    const bill = readFileSync(join(CONFIRM, 'bill.tsx'), 'utf8');
    expect(bill).toMatch(/confirm-5-bill/);
    expect(bill).toMatch(/TemplateFieldsForm|getTemplateForDraft/);
    expect(bill).toMatch(/Looks right/);

    const rx = readFileSync(join(CONFIRM, 'rx.tsx'), 'utf8');
    expect(rx).toMatch(/confirm-5-rx/);
    expect(rx).toMatch(/TemplateFieldsForm|getTemplateForDraft/);
    expect(rx).toMatch(/Looks right/);

    const lab = readFileSync(join(CONFIRM, 'lab.tsx'), 'utf8');
    expect(lab).toMatch(/confirm-5-lab/);
    expect(lab).toMatch(/TemplateFieldsForm|Document language|from your document/);

    const skin = readFileSync(join(CONFIRM, 'skin.tsx'), 'utf8');
    expect(skin).toMatch(/confirm-5-skin/);
    expect(skin).toMatch(/TemplateFieldsForm/);
    expect(skin).toMatch(/AI SUGGESTS/);

    const mark = readFileSync(join(CONFIRM, 'mark.tsx'), 'utf8');
    expect(mark).toMatch(/confirm-5-mark/);
    expect(mark).toMatch(/TemplateFieldsForm/);
    expect(mark).toMatch(/useCaptureConfirm/);
    expect(mark).toMatch(/submitLooksRight/);

    const other = readFileSync(join(CONFIRM, 'other.tsx'), 'utf8');
    expect(other).toMatch(/confirm-5-other/);

    // Field-level testIDs live on TemplateFieldsForm (confirm-field-{key})
    const form = readFileSync(join(ROOT, 'components/capture/TemplateFieldsForm.tsx'), 'utf8');
    expect(form).toMatch(/confirm-field-\$\{field\.key\}/);

    // Fail loud if someone collapses to one shared Date+Area template
    expect(existsSync(join(CONFIRM, 'index.tsx'))).toBe(false);
    const sharedTemplate = [
      readFileSync(join(CONFIRM, 'bill.tsx'), 'utf8'),
      readFileSync(join(CONFIRM, 'rx.tsx'), 'utf8'),
      readFileSync(join(CONFIRM, 'lab.tsx'), 'utf8'),
    ];
    for (const src of sharedTemplate) {
      expect(src).not.toMatch(/confirm-skin-area/);
    }
  });
});

describe('P7.06 Thesis variants — six separate copy sets', () => {
  it('each tag owns distinct title/body — not one templated paragraph', () => {
    const skin = readFileSync(join(THESIS, 'skin.tsx'), 'utf8');
    const bill = readFileSync(join(THESIS, 'bill.tsx'), 'utf8');
    const rx = readFileSync(join(THESIS, 'rx.tsx'), 'utf8');
    const mark = readFileSync(join(THESIS, 'mark.tsx'), 'utf8');
    const lab = readFileSync(join(THESIS, 'lab.tsx'), 'utf8');
    const other = readFileSync(join(THESIS, 'other.tsx'), 'utf8');

    const extracted = [skin, bill, rx, mark, lab, other].map((src) => {
      const m = src.match(/THESIS_\w+_TITLE = ['"]([^'"]+)['"]/);
      expect(m, 'title export').toBeTruthy();
      return m![1];
    });
    expect(new Set(extracted).size).toBe(6);
    expect(extracted).toContain('What this typically involves');
    expect(extracted).toContain('One less thing to remember');
    expect(extracted).toContain('Never miss a refill again');

    for (const tag of ['skin', 'bill', 'rx', 'mark', 'lab', 'other']) {
      const src = readFileSync(join(THESIS, `${tag}.tsx`), 'utf8');
      expect(src).toMatch(new RegExp(`thesis-6-${tag}`));
      expect(src).toMatch(/not a shared single-paragraph template/);
    }
    // No umbrella thesis screen
    expect(existsSync(join(THESIS, 'index.tsx'))).toBe(false);
  });
});

describe('P7.07 Daily T5b AI SUGGESTS on authenticated Track', () => {
  it('screen labels AI SUGGESTS and Track routes into it', () => {
    const daily = readFileSync(join(APP, 'capture/daily-ai-suggests.tsx'), 'utf8');
    expect(daily).toMatch(/DAILY_AI_SUGGESTS_LABEL = 'AI SUGGESTS:'/);
    expect(daily).toMatch(/screen-t5b-daily-ai-suggests/);
    expect(daily).toMatch(/daily-ai-suggests-label/);
    expect(daily).toMatch(/AI SUGGESTS:/);

    const track = readFileSync(join(APP, '(tabs)/track.tsx'), 'utf8');
    expect(track).toMatch(/DAILY_AI_SUGGESTS_HREF/);
    expect(track).toMatch(/AI SUGGESTS/);
    expect(track).toMatch(/CAPTURE_2A_HREF/);
  });
});

describe('P7.08 Shelf Buy vs Rx — Rx never Buy', () => {
  it('skincare may Buy; prescription never shows Buy CTA', () => {
    const src = readFileSync(
      join(ROOT, 'components/shelf/ShelfItemActions.tsx'),
      'utf8',
    );
    expect(src).toMatch(/shelf-skincare-buy/);
    expect(src).toMatch(/shelf-rx-never-buy/);
    expect(src).toMatch(/shelf-rx-refill-cta/);
    expect(src).toMatch(/SHELF_RX_NEVER_BUY/);
    // Final gate is SSOT (kind alone must not win over is_prescription)
    expect(src).toMatch(/canShowBuyCta/);
    expect(src).toMatch(/isPrescriptionShelfItem/);
    expect(SHELF_RX_NEVER_BUY).toMatch(/never sells or refills prescription medication/);

    const shelf = readFileSync(join(APP, '(tabs)/shelf.tsx'), 'utf8');
    expect(shelf).toMatch(/ShelfItemActions/);
    expect(shelf).toMatch(/\/api\/patient\/shelf\/products/);
    expect(shelf).toMatch(/shelfItemCommerceKind/);
    // No hardcoded demo kinds
    expect(shelf).not.toMatch(/kind="prescription"/);
    expect(shelf).not.toMatch(/kind="skincare"/);

    // P8.07 Ask/Learn live (replaces Coming soon) — still no dead CTAs
    expect(src).toMatch(/shelf-ask-action/);
    expect(src).toMatch(/shelf-learn-action/);
    expect(src).toMatch(/\/api\/patient\/shelf\/ask-learn/);
    expect(src).not.toMatch(/Coming soon/);
  });
});
