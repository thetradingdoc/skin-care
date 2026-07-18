/**
 * Phase F close-out — adversarial tests for CTA / Buy policy fixes.
 *
 * 1. Unknown classification never allows Buy (Shelf/shop fail-closed = barcode-depth).
 * 2. Unlock AI opens Linking(url) or fails visibly — no silent Profile navigate.
 * 3. try-reveal Buy requires real variantId/handle or blocks with error.
 * 4. Shelf Buy never fabricates $24.00 when priceLabel is missing.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  barcodeDepthAllowsBuyFromItem,
  canShowBuyCta,
  hasKnownBuyableClassification,
  isPrescriptionShelfItem,
} from '@/lib/shelf-commerce-cta';
import { unlockCheckoutUrlFromResponse } from '@/lib/unlock-ai-checkout';
import {
  TRY_REVEAL_BUY_BLOCKED,
  commerceIdsFromTryReveal,
  tryRevealCanCheckout,
} from '@/lib/try-reveal-commerce';

const ROOT = join(__dirname, '../..');
const APP = join(ROOT, 'app');

describe('Phase F — unknown classification fail-closed Buy (adversarial)', () => {
  it.each([
    {},
    { category: null },
    { category: '' },
    { category: 'treatment' }, // OBF / shelf default bucket — not explicit OTC
    { category: 'other' },
    { is_prescription: false },
    { is_prescription: false, category: 'treatment' },
    { tag: 'unknown' },
    null,
    undefined,
  ])('rejects Buy for unknown shape %j', (shape) => {
    expect(canShowBuyCta(shape as never)).toBe(false);
    expect(hasKnownBuyableClassification(shape as never)).toBe(false);
  });

  it('still rejects Rx even when kind lies as skincare', () => {
    expect(canShowBuyCta({ kind: 'skincare', is_prescription: true })).toBe(false);
    expect(isPrescriptionShelfItem({ kind: 'skincare', is_prescription: true })).toBe(true);
  });

  it('allows Buy only for explicit OTC/skincare classification', () => {
    expect(canShowBuyCta({ category: 'skincare' })).toBe(true);
    expect(canShowBuyCta({ category: 'otc', is_prescription: false })).toBe(true);
    expect(canShowBuyCta({ kind: 'cosmetic' })).toBe(true);
    expect(canShowBuyCta({ product_kind: 'skincare' }, { verdict: 'safe' })).toBe(true);
  });

  it('Shelf/shop gate matches barcode-depth on the same shapes', () => {
    const unknown = { category: 'treatment' };
    const otc = { category: 'skincare' };
    const rx = { is_prescription: true, category: 'skincare' };
    expect(canShowBuyCta(unknown)).toBe(barcodeDepthAllowsBuyFromItem(unknown, 'safe'));
    expect(canShowBuyCta(otc, { verdict: 'safe' })).toBe(
      barcodeDepthAllowsBuyFromItem(otc, 'safe'),
    );
    expect(canShowBuyCta(rx, { verdict: 'safe' })).toBe(
      barcodeDepthAllowsBuyFromItem(rx, 'safe'),
    );
    expect(canShowBuyCta(unknown)).toBe(false);
    expect(canShowBuyCta(rx)).toBe(false);
  });

  it('shop + shelf screens still call canShowBuyCta (not a parallel gate)', () => {
    const shop = readFileSync(join(APP, 'shop/[handle].tsx'), 'utf8');
    const shelfActions = readFileSync(join(ROOT, 'components/shelf/ShelfItemActions.tsx'), 'utf8');
    expect(shop).toMatch(/canShowBuyCta/);
    expect(shelfActions).toMatch(/canShowBuyCta/);
  });
});

describe('Phase F — Unlock AI checkout (adversarial)', () => {
  it('extracts checkout url only when present', () => {
    expect(unlockCheckoutUrlFromResponse({ url: 'https://checkout.example/x' })).toBe(
      'https://checkout.example/x',
    );
    expect(unlockCheckoutUrlFromResponse({ url: '  ' })).toBe(null);
    expect(unlockCheckoutUrlFromResponse({})).toBe(null);
    expect(unlockCheckoutUrlFromResponse(null)).toBe(null);
  });

  it('screen opens Linking or shows error — never silent router.replace to Profile', () => {
    const src = readFileSync(join(APP, 'capture/unlock-ai.tsx'), 'utf8');
    expect(src).toMatch(/Linking\.openURL/);
    expect(src).toMatch(/unlock-checkout-error/);
    expect(src).toMatch(/Checkout unavailable|Checkout failed/);
    expect(src).not.toMatch(/router\.replace\(PROFILE/);
    expect(src).not.toMatch(/PROFILE_HREF/);
    // No empty catch that swallows then navigates
    expect(src).not.toMatch(/catch\s*\{\s*\/\*\s*stay/);
  });
});

describe('Phase F — try-reveal Buy requires real commerce ids (adversarial)', () => {
  it('blocks checkout when variantId and handle are absent', () => {
    const ids = commerceIdsFromTryReveal({
      product: { product_name: 'Niacinamide' },
      verdict: { overall: 'safe' },
    });
    expect(tryRevealCanCheckout(ids)).toBe(false);
    expect(TRY_REVEAL_BUY_BLOCKED).toMatch(/no store product linked/i);
  });

  it('allows checkout when handle or variantId is present on product or verdict', () => {
    expect(
      tryRevealCanCheckout(
        commerceIdsFromTryReveal({
          product: { handle: 'niacinamide-serum' },
          verdict: { overall: 'safe' },
        }),
      ),
    ).toBe(true);
    expect(
      tryRevealCanCheckout(
        commerceIdsFromTryReveal({
          product: {},
          verdict: { shopify_variant_id: 'gid://shopify/ProductVariant/1' },
        }),
      ),
    ).toBe(true);
  });

  it('screen never pushes bare CHECKOUT_HANDOFF_HREF without params', () => {
    const src = readFileSync(join(APP, 'try-reveal.tsx'), 'utf8');
    expect(src).toMatch(/checkoutHandoffHref/);
    expect(src).toMatch(/reveal-swap-buy-blocked|reveal-buy-error/);
    expect(src).toMatch(/TRY_REVEAL_BUY_BLOCKED|tryRevealCanCheckout/);
    expect(src).not.toMatch(/router\.push\(CHECKOUT_HANDOFF_HREF\)/);
  });
});

describe('Phase F — Shelf Buy never fabricates $24.00 (adversarial)', () => {
  it('source has no hardcoded $24.00 fallback', () => {
    const src = readFileSync(join(ROOT, 'components/shelf/ShelfItemActions.tsx'), 'utf8');
    expect(src).not.toMatch(/\$24\.00/);
    expect(src).toMatch(/shelf-buy-price-unavailable/);
    expect(src).toMatch(/Price unavailable/);
    // Buy label only uses real trimmed priceLabel
    expect(src).toMatch(/buy · \{String\(priceLabel\)\.trim\(\)\}/);
  });
});
