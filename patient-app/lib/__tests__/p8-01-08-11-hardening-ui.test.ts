/**
 * P8.01 / P8.02 / P8.08 / P8.11 — patient-app Phase 8 UI contracts.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { classifyCaptureApiError } from '@/lib/capture-limit-routing';
import { formatBillMoney } from '@/lib/format-bill-money';
import {
  barcodeDepthAllowsBuy,
  mapBarcodeProductKind,
} from '@/lib/barcode-verdict-depth';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('P8.01 Burst guard UX', () => {
  it('maps AI_BURST_LIMIT to burst screen (enforcement is server-side)', () => {
    expect(classifyCaptureApiError({ status: 429, error_code: 'AI_BURST_LIMIT' })).toBe('burst');
    expect(classifyCaptureApiError({ status: 402, error_code: 'AI_CAPTURE_LIMIT' })).toBe('monthly');
    expect(existsSync(join(APP, 'capture/ai-burst.tsx'))).toBe(true);
    const src = readFileSync(join(APP, 'capture/ai-burst.tsx'), 'utf8');
    expect(src).toMatch(/screen-t6b-ai-burst/);
    expect(src).toMatch(/AI_BURST_LIMIT/);
    expect(src).toMatch(/10 in 24 hours/);
  });
});

describe('P8.08 Barcode depth — Rx never Buy', () => {
  it('prescription barcode never allows Buy; skincare safe may Buy', () => {
    expect(mapBarcodeProductKind({ is_prescription: true })).toBe('prescription');
    expect(barcodeDepthAllowsBuy('prescription', 'safe')).toBe(false);
    expect(barcodeDepthAllowsBuy('prescription', 'caution')).toBe(false);
    expect(barcodeDepthAllowsBuy('skincare', 'safe')).toBe(true);
    expect(barcodeDepthAllowsBuy('skincare', 'hard_no')).toBe(false);
    const src = readFileSync(join(APP, 'barcode-verdict-depth.tsx'), 'utf8');
    expect(src).toMatch(/barcode-rx-never-buy/);
    expect(src).toMatch(/barcodeDepthAllowsBuy/);
  });
});

describe('P8.11 Bill multi-currency locale format', () => {
  it('formats with Intl using stored currency — amount_cents minor units', () => {
    expect(formatBillMoney(8400, 'EUR', 'en-US')).toMatch(/€|EUR/);
    expect(formatBillMoney(8400, 'EUR', 'en-US')).toMatch(/84/);
    expect(formatBillMoney(8400, 'USD', 'en-US')).toBe('$84.00');
    expect(formatBillMoney(84, 'USD', 'en-US')).toBe('$0.84');
    expect(formatBillMoney(1000, 'JPY', 'en-US')).toMatch(/¥|JPY|1,000/);
    const confirm = readFileSync(join(APP, 'capture/confirm/bill.tsx'), 'utf8');
    expect(confirm).toMatch(/TemplateFieldsForm/);
    expect(confirm).toMatch(/amount_cents|getTemplateForDraft/);
    const form = readFileSync(join(ROOT, 'components/capture/TemplateFieldsForm.tsx'), 'utf8');
    expect(form).toMatch(/money_cents/);
    expect(form).toMatch(/Math\.round\(major \* 100\)/);
    const reveal = readFileSync(join(APP, 'capture/reveal/bill.tsx'), 'utf8');
    expect(reveal).toMatch(/formatBillMoney/);
    expect(reveal).toMatch(/amount_cents/);
  });
});
