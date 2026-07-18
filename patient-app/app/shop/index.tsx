/**
 * TOUCH-080 — Screen 15 Shop browse (contextual entry only — no tab icon).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { PROGRESS_HREF, shopProductHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';

type ShopProduct = {
  handle: string;
  product_name: string;
  brand?: string;
  summary?: string;
  price_label?: string;
};

export default function ShopBrowseScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ShopProduct[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientGet('/api/patient/shop/catalog');
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (checking || !ready) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Shop</Text>
        <Pressable onPress={() => router.replace(PROGRESS_HREF)}>
          <Text style={styles.back}>Check</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{COMMERCE_COPY.shopBrowseHint}</Text>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={AppTokens.color.fabBg} /> : null}
        {products.map((p) => (
          <Pressable
            key={p.handle}
            style={styles.card}
            onPress={() => router.push(shopProductHref(p.handle))}
            testID={`shop-product-${p.handle}`}>
            <Text style={styles.name}>{p.product_name}</Text>
            <Text style={styles.meta}>
              {p.brand || 'touche labs™'}
              {p.price_label ? ` · ${p.price_label}` : ''}
            </Text>
            {p.summary ? <Text style={styles.summary}>{p.summary}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: { fontFamily: AppTokens.font.body, color: AppTokens.color.ink },
  title: { fontFamily: AppTokens.font.display, fontSize: 18 },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
  },
  content: { padding: 16, gap: 12 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  name: { fontFamily: AppTokens.font.display, fontSize: 18, color: AppTokens.color.ink },
  meta: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  summary: { fontFamily: AppTokens.font.body, fontSize: 14, color: AppTokens.color.ink, marginTop: 4 },
});
