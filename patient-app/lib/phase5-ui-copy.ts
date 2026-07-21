/**
 * Phase 5 UI copy SSOT — locked strings (no safety / no inferred value claims).
 */

/** Scan barcode miss — never "not safe" / safety framing. */
export const SHELF_NO_CATALOG_MATCH =
  "This product isn't in our catalog yet — you can still add it by name.";

/** Spend summary — arithmetic only (matches API honesty.arithmetic_only). */
export const SPEND_SUMMARY_LABEL = 'Shelf prices logged';
/** Mock v4.1 spend-pill honesty — never imply savings. */
export const SPEND_SUMMARY_HONESTY = 'logged — not a savings estimate';

/** Shelf empty (v4.1 frame 27). */
export const SHELF_EMPTY_TITLE = 'Your shelf is empty';
export const SHELF_EMPTY_BODY =
  "Scan a barcode or add by name — we'll show you what's actually in it.";
export const SHELF_EMPTY_CTA = 'Add a product';

/** Rx badge on shelf row / detail (v4.1 frame 28). */
export const SHELF_RX_BADGE = 'PRESCRIPTION — REFILL ONLY, NOT FOR SALE HERE';
export const SHELF_RX_REFILL_CTA = 'Request refill';

/** Rx confirm shelf opt-in question. */
export function addRxToShelfPrompt(drugName: string): string {
  const name = String(drugName || '').trim() || 'this prescription';
  return `Add ${name} to Shelf?`;
}
