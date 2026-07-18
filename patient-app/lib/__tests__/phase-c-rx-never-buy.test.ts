/**
 * Phase C — adversarial: Buy CTA must never appear on prescription items
 * across Shelf tab, shop PDP, verdict (barcode-entry), and barcode-depth.
 *
 * Same standard as mapPrimary false-safe: attempt to force the unsafe outcome
 * through every entry path independently — not only assert the happy path omits it.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  barcodeDepthAllowsBuy,
  mapBarcodeProductKind,
} from '@/lib/barcode-verdict-depth';
import {
  canShowBuyCta,
  isPrescriptionShelfItem,
  shelfItemCommerceKind,
  SHELF_RX_NEVER_BUY,
} from '@/lib/shelf-commerce-cta';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

const RX_FORCE_SHAPES = [
  { is_prescription: true },
  { is_prescription: true, category: 'skincare' }, // flag wins over category lie
  { category: 'prescription' },
  { category: 'rx' },
  { tag: 'prescription' },
  { kind: 'prescription' },
  { product_kind: 'prescription' },
  { category: 'Prescription Medication' },
];

describe('Phase C SSOT — canShowBuyCta rejects Rx (adversarial shapes)', () => {
  it.each(RX_FORCE_SHAPES)('rejects Buy for %j', (shape) => {
    expect(isPrescriptionShelfItem(shape)).toBe(true);
    expect(canShowBuyCta(shape)).toBe(false);
    expect(canShowBuyCta(shape, { verdict: 'safe' })).toBe(false);
    expect(shelfItemCommerceKind(shape)).toBe('prescription');
  });

  it('allows Buy for clear OTC / skincare', () => {
    expect(canShowBuyCta({ category: 'skincare', is_prescription: false })).toBe(true);
    expect(canShowBuyCta({ category: 'skincare' })).toBe(true);
    expect(canShowBuyCta({ kind: 'skincare' })).toBe(true);
    // treatment-default / empty = unknown → never Buy (fail-closed)
    expect(canShowBuyCta({ category: 'treatment', is_prescription: false })).toBe(false);
    expect(canShowBuyCta({})).toBe(false);
  });

  it('never allows Buy on hard_no even for OTC', () => {
    expect(canShowBuyCta({ category: 'skincare' }, { verdict: 'hard_no' })).toBe(false);
    expect(canShowBuyCta({ category: 'skincare' }, { verdict: 'error' })).toBe(false);
  });
});

describe('Phase C path 1 — Shelf tab (manual browse)', () => {
  it('lists only GET /shelf/products rows — no demo Niacinamide/Tretinoin inject', () => {
    const shelf = readFileSync(join(APP, '(tabs)/shelf.tsx'), 'utf8');
    expect(shelf).toMatch(/\/api\/patient\/shelf\/products/);
    expect(shelf).toMatch(/shelf-inventory-actions/);
    expect(shelf).toMatch(/shelf-empty/);
    expect(shelf).not.toMatch(/Niacinamide Serum/);
    expect(shelf).not.toMatch(/Tretinoin 0\.025%/);
    expect(shelf).not.toMatch(/shelf-buy-vs-rx-demo/);
    expect(shelf).not.toMatch(/kind="skincare"/);
    expect(shelf).not.toMatch(/kind="prescription"/);
    // Actions driven from row classification, not hardcoded screen kinds
    expect(shelf).toMatch(/shelfItemCommerceKind/);
    expect(shelf).toMatch(/is_prescription/);
    expect(shelf).toMatch(/ShelfItemActions/);
  });

  it('ShelfItemActions final gate is canShowBuyCta (not kind alone)', () => {
    const src = readFileSync(join(ROOT, 'components/shelf/ShelfItemActions.tsx'), 'utf8');
    expect(src).toMatch(/canShowBuyCta/);
    expect(src).toMatch(/isPrescriptionShelfItem/);
    expect(src).toMatch(/shelf-skincare-buy/);
    expect(src).toMatch(/shelf-rx-never-buy/);
    expect(src).toMatch(/SHELF_RX_NEVER_BUY/);
    expect(SHELF_RX_NEVER_BUY).toMatch(/never sells or refills prescription medication/);
    // Adversarial: kind=skincare must still lose when is_prescription
    expect(canShowBuyCta({ kind: 'skincare', is_prescription: true })).toBe(false);
  });
});

describe('Phase C path 2 — shop/[handle] PDP', () => {
  it('wires canShowBuyCta before shop-buy (Rx never reaches Buy)', () => {
    const src = readFileSync(join(APP, 'shop/[handle].tsx'), 'utf8');
    expect(src).toMatch(/canShowBuyCta/);
    expect(src).toMatch(/isPrescriptionShelfItem/);
    expect(src).toMatch(/shop-rx-never-buy/);
    expect(src).toMatch(/shop-buy/);
    // Buy only when allowBuy — not commerceOn alone
    expect(src).toMatch(/commerceOn && allowBuy/);
    expect(src).toMatch(/shop-buy-hidden/);
  });

  it('adversarial: force Buy decision on Rx shop product shape → rejected', () => {
    const rxShop = {
      handle: 'rx-tretinoin-guard',
      is_prescription: true,
      category: 'prescription',
    };
    expect(canShowBuyCta(rxShop, { verdict: 'safe' })).toBe(false);
  });
});

describe('Phase C path 3 — verdict/[productId] (barcode scan entry)', () => {
  it('renders ShelfItemActions from shelf row classification (scan → verdict)', () => {
    const src = readFileSync(join(APP, 'verdict/[productId].tsx'), 'utf8');
    expect(src).toMatch(/verdict-commerce-cta/);
    expect(src).toMatch(/ShelfItemActions/);
    expect(src).toMatch(/shelfItemCommerceKind/);
    expect(src).toMatch(/is_prescription/);
    expect(src).toMatch(/\/api\/patient\/shelf\/products/);
  });

  it('scan tab still lands on verdict (barcode entry path)', () => {
    const scan = readFileSync(join(APP, '(tabs)/scan.tsx'), 'utf8');
    expect(scan).toMatch(/verdictHref/);
    expect(scan).toMatch(/scanBarcodeToShelf/);
  });

  it('adversarial: Rx shelf row after scan must reject Buy', () => {
    const scannedRx = {
      id: 'shelf_rx_1',
      category: 'prescription',
      is_prescription: true,
      product_name: 'Tretinoin',
    };
    expect(canShowBuyCta(scannedRx)).toBe(false);
    expect(shelfItemCommerceKind(scannedRx)).toBe('prescription');
  });
});

describe('Phase C path 4 — barcode-verdict-depth (depth screen)', () => {
  it('uses same SSOT — prescription never Buy on every verdict', () => {
    expect(mapBarcodeProductKind({ is_prescription: true })).toBe('prescription');
    expect(barcodeDepthAllowsBuy('prescription', 'safe')).toBe(false);
    expect(barcodeDepthAllowsBuy('prescription', 'caution')).toBe(false);
    expect(barcodeDepthAllowsBuy('prescription', 'hard_no')).toBe(false);
    expect(barcodeDepthAllowsBuy('skincare', 'safe')).toBe(true);
    const src = readFileSync(join(APP, 'barcode-verdict-depth.tsx'), 'utf8');
    expect(src).toMatch(/barcodeDepthAllowsBuy/);
    expect(src).toMatch(/barcode-rx-never-buy/);
  });
});

describe('Phase C T4b — empty shelf is real empty API, not demo overlay', () => {
  it('empty branch has no ShelfItemActions / demo inject', () => {
    const shelf = readFileSync(join(APP, '(tabs)/shelf.tsx'), 'utf8');
    expect(shelf).toMatch(/products\.length === 0 && !loading/);
    expect(shelf).toMatch(/testID="shelf-empty"/);
    // Empty UI and inventory actions are mutually exclusive branches
    expect(shelf).toMatch(/shelf-empty[\s\S]*shelf-inventory-actions|shelf-inventory-actions[\s\S]*shelf-empty/);
    expect(shelf).not.toMatch(/Niacinamide/);
    expect(shelf).not.toMatch(/shelf-buy-vs-rx-demo/);
    // Empty state must not inject sample ShelfItemActions outside the products.map
    const emptyIdx = shelf.indexOf('testID="shelf-empty"');
    const mapIdx = shelf.indexOf('products.map');
    expect(emptyIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(emptyIdx);
  });
});
