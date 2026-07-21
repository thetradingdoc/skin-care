/**
 * TOUCH-081 — Screen 16 Product detail + evaluate badge → Buy (Screen 17).
 */
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { checkoutHandoffHref } from '@/constants/routes';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';
import {
  SHELF_RX_NEVER_BUY,
  canShowBuyCta,
  isPrescriptionShelfItem,
} from '@/lib/shelf-commerce-cta';

export default function ShopProductScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [badge, setBadge] = useState<{ label?: string; overall?: string } | null>(null);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ready || !handle) return;
    void (async () => {
      setLoading(true);
      try {
        const status = await patientGet('/api/patient/commerce/status').catch(() => null);
        if (status?.commerce_ctas_enabled) setCommerceOn(true);
        const data = await patientGet(`/api/patient/shop/products/${encodeURIComponent(String(handle))}`);
        setProduct((data?.product as Record<string, unknown>) || null);
        setBadge((data?.evaluate_badge as { label?: string; overall?: string }) || null);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, handle]);

  const hideHeader = <Stack.Screen options={{ headerShown: false, title: '' }} />;

  // Empty shell until client mount — ActivityIndicator / session branches diverge
  // between Expo static HTML and hydration (React #418).
  if (!mounted) {
    return (
      <>
        {hideHeader}
        <SafeAreaView style={styles.root} testID="shop-pdp-pending" />
      </>
    );
  }

  if (checking || !ready || loading) {
    return (
      <>
        {hideHeader}
        <SafeAreaView style={styles.root}>
          <ActivityIndicator style={{ marginTop: 48 }} color={AppTokens.color.fabBg} />
        </SafeAreaView>
      </>
    );
  }

  if (!product) {
    return (
      <>
        {hideHeader}
        <SafeAreaView style={styles.root}>
          <Text style={styles.missing}>Product not found</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Back</Text>
          </Pressable>
        </SafeAreaView>
      </>
    );
  }

  // Do not default missing evaluate badge to "safe".
  const overall = badge?.overall ? String(badge.overall).toLowerCase() : '';
  const badgeStyle =
    overall === 'hard_no' || overall === 'avoid'
      ? styles.badgeHard
      : overall === 'caution'
        ? styles.badgeCaution
        : overall === 'safe'
          ? styles.badgeSafe
          : styles.badgeUnknown;

  // Phase C — same Rx-never-Buy SSOT as Shelf / barcode (not commerce-flag alone).
  const commerceItem = {
    is_prescription: product.is_prescription === true,
    category: product.category != null ? String(product.category) : null,
    tag: product.tag != null ? String(product.tag) : null,
  };
  const isRx = isPrescriptionShelfItem(commerceItem);
  const allowBuy = canShowBuyCta(commerceItem, { verdict: overall || null });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, title: '' }} />
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.link}>Back</Text>
      </Pressable>
      <View style={styles.body} testID="shop-product-detail">
        <Text style={styles.title}>{String(product.product_name)}</Text>
        <Text style={styles.meta}>
          {String(product.brand || 'skiñcare')}
          {product.price_label ? ` · ${String(product.price_label)}` : ''}
        </Text>
        {product.summary ? <Text style={styles.summary}>{String(product.summary)}</Text> : null}
        {badge && overall ? (
          <View style={[styles.badge, badgeStyle]} testID="shop-evaluate-badge">
            <Text style={styles.badgeText}>{badge.label || overall}</Text>
          </View>
        ) : null}

        {isRx ? (
          <Text style={styles.rxNever} testID="shop-rx-never-buy">
            {SHELF_RX_NEVER_BUY}
          </Text>
        ) : null}

        {commerceOn && allowBuy ? (
          <Pressable
            style={styles.buy}
            testID="shop-buy"
            onPress={() =>
              router.push(
                checkoutHandoffHref({
                  variantId: String(product.shopify_variant_id || ''),
                  handle: String(product.handle || handle),
                  mode: 'cart',
                }),
              )
            }>
            <Text style={styles.buyText}>Buy</Text>
          </Pressable>
        ) : !isRx ? (
          <Text style={styles.off} testID="shop-commerce-off">
            {commerceOn
              ? 'Buy unavailable for this product.'
              : 'Checkout opens when commerce is enabled.'}
          </Text>
        ) : (
          <Text style={styles.off} testID="shop-buy-hidden">
            buy_cta_hidden
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  backBtn: { padding: 16 },
  link: { color: AppTokens.color.ink, fontFamily: AppTokens.font.body },
  body: { padding: 20, gap: 10 },
  title: { fontFamily: AppTokens.font.display, fontSize: 26, color: AppTokens.color.ink },
  meta: { fontFamily: AppTokens.font.body, color: AppTokens.color.muted },
  summary: { fontFamily: AppTokens.font.body, fontSize: 15, color: AppTokens.color.ink, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeSafe: { backgroundColor: AppTokens.color.safe },
  badgeCaution: { backgroundColor: AppTokens.color.terracotta },
  badgeHard: { backgroundColor: AppTokens.color.hardNo },
  badgeUnknown: { backgroundColor: AppTokens.color.ink },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  buy: {
    marginTop: 16,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buyText: { color: '#fff', fontWeight: '700' },
  off: { marginTop: 16, color: AppTokens.color.muted, fontFamily: AppTokens.font.body },
  rxNever: {
    marginTop: 16,
    fontSize: 13,
    color: AppTokens.color.cardRedText,
    backgroundColor: AppTokens.color.cardRed,
    padding: 10,
    borderRadius: 8,
    fontFamily: AppTokens.font.body,
  },
  missing: { marginTop: 48, textAlign: 'center', color: AppTokens.color.muted },
});
