/**
 * Phase C — backend: is_prescription on shelf rows + scan category not hardcoded treatment.
 */
'use strict';

const {
  formatShelfProductApiRow,
  isPrescriptionShelfCategory,
  resolveShelfCategoryFromScan,
} = require('../lib/patient-shelf-api');

describe('Phase C shelf API classification', () => {
  test('isPrescriptionShelfCategory matches Rx shapes', () => {
    expect(isPrescriptionShelfCategory('prescription')).toBe(true);
    expect(isPrescriptionShelfCategory('rx')).toBe(true);
    expect(isPrescriptionShelfCategory('Prescription')).toBe(true);
    expect(isPrescriptionShelfCategory('treatment')).toBe(false);
    expect(isPrescriptionShelfCategory('skincare')).toBe(false);
  });

  test('formatShelfProductApiRow exposes is_prescription from category', () => {
    const rx = formatShelfProductApiRow({
      id: 's1',
      custom_product_name: 'Tretinoin',
      category: 'prescription',
      usage_time: 'pm',
    });
    expect(rx.is_prescription).toBe(true);
    expect(rx.category).toBe('prescription');

    const otc = formatShelfProductApiRow({
      id: 's2',
      custom_product_name: 'Niacinamide',
      category: 'treatment',
      usage_time: 'am',
    });
    expect(otc.is_prescription).toBe(false);
  });

  test('resolveShelfCategoryFromScan: body.is_prescription forces prescription', () => {
    expect(
      resolveShelfCategoryFromScan({
        body: { is_prescription: true },
        normalized: { product_name: 'Something', categories: [] },
      }),
    ).toBe('prescription');
  });

  test('resolveShelfCategoryFromScan: body.category respected', () => {
    expect(
      resolveShelfCategoryFromScan({
        body: { category: 'prescription' },
        normalized: { product_name: 'Serum', categories: ['Face serums'] },
      }),
    ).toBe('prescription');
  });

  test('resolveShelfCategoryFromScan: OBF prescription markers', () => {
    expect(
      resolveShelfCategoryFromScan({
        body: {},
        normalized: {
          product_name: 'Drug X',
          categories: ['Prescription drugs'],
          categories_tags: ['en:prescription'],
        },
      }),
    ).toBe('prescription');
  });

  test('resolveShelfCategoryFromScan: default OTC treatment (not silent Rx)', () => {
    expect(
      resolveShelfCategoryFromScan({
        body: {},
        normalized: {
          product_name: 'Gentle Cleanser',
          categories: ['Face cleansers'],
          categories_tags: ['en:facial-cleansers'],
        },
      }),
    ).toBe('treatment');
  });
});

describe('Phase C shop catalog Rx guard fixture', () => {
  test('getShopProduct returns Rx fixture; listShopCatalog excludes it', () => {
    const { getShopProduct, listShopCatalog } = require('../lib/touche-shop-catalog');
    const rx = getShopProduct('rx-tretinoin-guard');
    expect(rx).toBeTruthy();
    expect(rx.is_prescription).toBe(true);
    expect(listShopCatalog().some((p) => p.handle === 'rx-tretinoin-guard')).toBe(false);
    expect(listShopCatalog().every((p) => p.is_prescription !== true)).toBe(true);
  });
});
