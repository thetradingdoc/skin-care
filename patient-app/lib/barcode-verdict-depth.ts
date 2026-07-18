/**
 * P8.08 — Barcode verdict depth: Safe / Caution / Hard-no.
 * Rx/prescription barcode products must never expose Buy.
 * Delegates the safety boundary to shelf-commerce-cta (Phase C SSOT).
 */

import {
  barcodeDepthAllowsBuyFromItem,
  isPrescriptionShelfItem,
  type ShelfCommerceItemInput,
} from '@/lib/shelf-commerce-cta';

export type BarcodeVerdictKind = 'safe' | 'caution' | 'hard_no' | 'error';
export type BarcodeProductKind = 'skincare' | 'prescription' | 'unknown';

export function mapBarcodeProductKind(input: {
  category?: string | null;
  is_prescription?: boolean | null;
  tag?: string | null;
}): BarcodeProductKind {
  if (isPrescriptionShelfItem(input)) return 'prescription';
  const cat = String(input.category || input.tag || '').toLowerCase();
  if (cat.includes('skin') || cat.includes('otc') || cat.includes('cosmetic')) {
    return 'skincare';
  }
  return 'unknown';
}

export function barcodeDepthAllowsBuy(
  productKind: BarcodeProductKind,
  verdict: BarcodeVerdictKind,
): boolean {
  const item: ShelfCommerceItemInput = {
    product_kind: productKind,
    kind: productKind,
    category: productKind === 'prescription' ? 'prescription' : productKind,
    is_prescription: productKind === 'prescription',
  };
  return barcodeDepthAllowsBuyFromItem(item, verdict);
}
