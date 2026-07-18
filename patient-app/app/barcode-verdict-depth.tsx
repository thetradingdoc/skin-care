/**
 * P8.08 — Barcode depth screens (Safe / Caution / Hard-no).
 * Prescription barcode items never get Buy (P4.12 / P7.08 boundary).
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { RX_REFILL_INFO_HREF, SHOP_HREF } from '@/constants/routes';
import {
  barcodeDepthAllowsBuy,
  mapBarcodeProductKind,
  type BarcodeVerdictKind,
} from '@/lib/barcode-verdict-depth';
import { SHELF_RX_NEVER_BUY } from '@/lib/shelf-commerce-cta';

export default function BarcodeVerdictDepthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    verdict?: string;
    productName?: string;
    category?: string;
    is_prescription?: string;
  }>();
  const verdict = (String(params.verdict || 'safe').toLowerCase() as BarcodeVerdictKind) || 'safe';
  const productKind = mapBarcodeProductKind({
    category: params.category,
    is_prescription: params.is_prescription === '1' || params.is_prescription === 'true',
  });
  const name = String(params.productName || 'Product');
  const allowsBuy = useMemo(
    () => barcodeDepthAllowsBuy(productKind, verdict),
    [productKind, verdict],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="barcode-verdict-depth">
      <Text style={styles.badge} testID={`barcode-depth-${verdict}`}>
        {verdict === 'hard_no' ? 'Hard no' : verdict === 'caution' ? 'Caution' : 'Safe'}
      </Text>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.kind} testID="barcode-product-kind">
        {productKind}
      </Text>

      {productKind === 'prescription' ? (
        <>
          <Text style={styles.never} testID="barcode-rx-never-buy">
            {SHELF_RX_NEVER_BUY}
          </Text>
          <Pressable
            testID="barcode-rx-refill"
            onPress={() =>
              router.push({ pathname: RX_REFILL_INFO_HREF, params: { drug: name } } as never)
            }>
            <Text style={styles.link}>refill info — contact your prescriber</Text>
          </Pressable>
        </>
      ) : null}

      {allowsBuy ? (
        <Pressable testID="barcode-skincare-buy" onPress={() => router.push(SHOP_HREF)}>
          <Text style={styles.buy}>Buy</Text>
        </Pressable>
      ) : (
        <Text style={styles.hiddenBuy} testID="barcode-buy-hidden">
          buy_cta_hidden
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg, padding: 20, gap: 12 },
  badge: { fontWeight: '700', fontSize: 14, color: AppTokens.color.fabBg },
  title: { fontSize: 24, fontWeight: '600', color: AppTokens.color.ink },
  kind: { color: AppTokens.color.muted },
  never: {
    backgroundColor: AppTokens.color.cardRed,
    color: AppTokens.color.cardRedText,
    padding: 10,
    borderRadius: 8,
  },
  link: { color: AppTokens.color.fabBg, fontWeight: '600' },
  buy: {
    backgroundColor: AppTokens.color.fabBg,
    color: '#fff',
    textAlign: 'center',
    padding: 14,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: '600',
  },
  hiddenBuy: { fontSize: 10, color: AppTokens.color.hint },
});
