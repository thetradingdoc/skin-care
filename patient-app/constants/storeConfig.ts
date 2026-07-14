/**
 * TOUCH-012 / TOUCH-069 / TOUCH-070 — Single SSOT for Shopify store origin + member discount.
 * URL builders and Profile shop links must import from here (no hardcoded duplicates).
 */
export const STORE_ORIGIN = (
  process.env.EXPO_PUBLIC_STORE_ORIGIN || 'https://trytouche.com'
).replace(/\/$/, '');

export const MEMBER_DISCOUNT_CODE =
  process.env.EXPO_PUBLIC_MEMBER_DISCOUNT_CODE || 'JOURNAL20';

export const TOUCHE_HOME_URL = STORE_ORIGIN;

/** App Store listing for Screen 6c (TOUCH-029). Override via EXPO_PUBLIC_APP_STORE_URL. */
export const APP_STORE_URL =
  process.env.EXPO_PUBLIC_APP_STORE_URL || 'https://apps.apple.com/app/touche/id6730000000';

export const TOUCHE_SKIN_COLLECTION_URL = `${STORE_ORIGIN}/collections/skin-by-touche-labs?utm_source=app&utm_medium=profile&utm_campaign=skin`;

function withUtm(url: string, source = 'journal'): string {
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}utm_source=${encodeURIComponent(source)}&utm_medium=app&utm_campaign=commerce`;
}

/** Cart permalink — always include `/cart/` (never omit path). TOUCH-069 */
export function buildShopifyCartUrl(variantId: string, discountCode = MEMBER_DISCOUNT_CODE): string {
  const id = String(variantId).trim();
  if (!id) throw new Error('variantId required');
  const code = encodeURIComponent(discountCode);
  const url = `${STORE_ORIGIN}/cart/${encodeURIComponent(id)}:1?discount=${code}`;
  if (!url.includes('/cart/')) throw new Error('cart path required');
  return withUtm(url);
}

/** PDP permalink. TOUCH-070 */
export function buildShopifyPdpUrl(handle: string, discountCode = MEMBER_DISCOUNT_CODE): string {
  const h = String(handle).trim();
  if (!h) throw new Error('handle required');
  const code = encodeURIComponent(discountCode);
  return withUtm(`${STORE_ORIGIN}/products/${encodeURIComponent(h)}?discount=${code}`);
}
