'use strict';

/**
 * Contextual shop catalog seed (TOUCH-080/081).
 * Replace with live Storefront when wired; variant IDs drive cart permalinks.
 */

const CATALOG = [
  {
    handle: 'barrier-calm-moisturizer',
    product_name: 'Barrier Calm Moisturizer',
    brand: 'touche labs™',
    summary: 'Ceramide-rich recovery cream for stressed barrier days.',
    shopify_variant_id: process.env.SHOP_VARIANT_BARRIER || '45000000000001',
    ingredients_text: 'ceramide np, glycerin, squalane',
    price_label: '$28',
  },
  {
    handle: 'gentle-gel-cleanser',
    product_name: 'Gentle Gel Cleanser',
    brand: 'touche labs™',
    summary: 'Low-foam cleanse without fragrance overload.',
    shopify_variant_id: process.env.SHOP_VARIANT_CLEANSER || '45000000000002',
    ingredients_text: 'glycerin, panthenol',
    price_label: '$18',
  },
  {
    handle: 'daily-mineral-spf',
    product_name: 'Daily Mineral SPF 30',
    brand: 'touche labs™',
    summary: 'Zinc-forward daytime shield.',
    shopify_variant_id: process.env.SHOP_VARIANT_SPF || '45000000000003',
    ingredients_text: 'zinc oxide, niacinamide',
    price_label: '$32',
  },
];

function listShopCatalog() {
  return CATALOG.map((p) => ({ ...p }));
}

function getShopProduct(handle) {
  const h = String(handle || '').trim().toLowerCase();
  return CATALOG.find((p) => p.handle === h) || null;
}

module.exports = { listShopCatalog, getShopProduct, CATALOG };
