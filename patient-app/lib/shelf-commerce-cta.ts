/**
 * Phase C / F — Shelf / shop / barcode commerce CTA SSOT.
 * Buy on a prescription item is the same severity class as false-safe evaluate.
 * Unknown classification must never allow Buy (fail-closed — same policy as barcode-depth).
 */

export const SHELF_RX_NEVER_BUY =
  'touche never sells or refills prescription medication';

export type ShelfCommerceItemInput = {
  is_prescription?: boolean | null;
  category?: string | null;
  tag?: string | null;
  product_kind?: string | null;
  /** Legacy ShelfItemActions kind — treated as a classification hint only */
  kind?: string | null;
};

export type ShelfCommerceKind = 'skincare' | 'prescription';

function classificationBlob(item: ShelfCommerceItemInput): string {
  return [item.category, item.tag, item.product_kind, item.kind]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x).toLowerCase().trim())
    .join(' ');
}

/** True when backend (or any field) classifies the item as prescription / Rx. */
export function isPrescriptionShelfItem(item: ShelfCommerceItemInput | null | undefined): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.is_prescription === true) return true;
  const blob = classificationBlob(item);
  if (!blob) return false;
  if (blob === 'prescription' || blob === 'rx') return true;
  if (/\bprescription\b/.test(blob) || /\brx\b/.test(blob)) return true;
  return false;
}

/**
 * Explicit OTC / skincare classification required before Buy.
 * Empty, treatment-default, and other unknown buckets fail closed (match barcode-depth).
 */
export function hasKnownBuyableClassification(
  item: ShelfCommerceItemInput | null | undefined,
): boolean {
  if (!item || typeof item !== 'object') return false;
  if (isPrescriptionShelfItem(item)) return false;
  const kind = String(item.product_kind || item.kind || item.category || '')
    .toLowerCase()
    .trim();
  if (!kind) return false;
  if (kind === 'skincare' || kind === 'otc' || kind === 'cosmetic') return true;
  if (kind.includes('skin')) return true;
  return false;
}

export function shelfItemCommerceKind(item: ShelfCommerceItemInput): ShelfCommerceKind {
  return isPrescriptionShelfItem(item) ? 'prescription' : 'skincare';
}

export type CanShowBuyCtaOpts = {
  /** Evaluate / barcode depth verdict — hard_no and error never get Buy even for OTC */
  verdict?: string | null;
};

/**
 * Sole Buy-CTA gate.
 * Prescription → never. Unknown classification → never. hard_no/error → never.
 * Only known OTC/skincare (or skin*) may Buy.
 */
export function canShowBuyCta(
  item: ShelfCommerceItemInput | null | undefined,
  opts: CanShowBuyCtaOpts = {},
): boolean {
  if (!hasKnownBuyableClassification(item)) return false;
  const verdict = String(opts.verdict || '')
    .toLowerCase()
    .trim();
  if (verdict === 'hard_no' || verdict === 'avoid' || verdict === 'error') return false;
  return true;
}

/**
 * Barcode depth shares the same fail-closed Buy gate as Shelf/shop.
 */
export function barcodeDepthAllowsBuyFromItem(
  item: ShelfCommerceItemInput,
  verdict: string | null | undefined,
): boolean {
  return canShowBuyCta(item, { verdict });
}
