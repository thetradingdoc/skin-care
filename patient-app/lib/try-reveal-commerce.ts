/**
 * Try-reveal commerce handoff helpers.
 * Buy/Swap must carry a real Shopify variantId or handle — never empty checkout-handoff.
 */

export type TryRevealCommerceIds = {
  variantId?: string;
  handle?: string;
};

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Pull commerce ids from evaluate verdict and/or pending product stash. */
export function commerceIdsFromTryReveal(payload: {
  product?: Record<string, unknown> | null;
  verdict?: Record<string, unknown> | null;
} | null | undefined): TryRevealCommerceIds {
  if (!payload) return {};
  const product = (payload.product || {}) as Record<string, unknown>;
  const verdict = (payload.verdict || {}) as Record<string, unknown>;
  const nested =
    verdict.product && typeof verdict.product === 'object'
      ? (verdict.product as Record<string, unknown>)
      : {};
  const variantId = pickString(
    product.shopify_variant_id,
    product.variant_id,
    verdict.shopify_variant_id,
    verdict.variant_id,
    nested.shopify_variant_id,
    nested.variant_id,
  );
  const handle = pickString(
    product.handle,
    product.shopify_handle,
    verdict.handle,
    verdict.shopify_handle,
    nested.handle,
    nested.shopify_handle,
  );
  return { variantId, handle };
}

export function tryRevealCanCheckout(ids: TryRevealCommerceIds): boolean {
  return Boolean(ids.variantId || ids.handle);
}

export const TRY_REVEAL_BUY_BLOCKED =
  'Buy unavailable — no store product linked for this result.';
