/**
 * TOUCH-082 — Screen 20 Order history (read-only by email). Refunds stay on Shopify.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { ORDER_CONFIRMATION_HREF } from '@/constants/routes';
import { TOUCHE_HOME_URL } from '@/constants/storeConfig';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';
import * as Linking from 'expo-linking';

type OrderRow = {
  shopify_order_id: string;
  financial_status?: string;
  created_at?: string;
  app_member?: number;
};

export default function OrdersScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientGet('/api/patient/orders');
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      setOrders([]);
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
        <Text style={styles.title}>Orders</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.hint}>{COMMERCE_COPY.confirmRefunds}</Text>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={AppTokens.color.fabBg} /> : null}
        {!loading && orders.length === 0 ? (
          <Text style={styles.empty}>No orders matched to this email yet.</Text>
        ) : null}
        {orders.map((o) => (
          <Pressable
            key={o.shopify_order_id}
            style={styles.card}
            testID={`order-row-${o.shopify_order_id}`}
            onPress={() =>
              router.push({
                pathname: ORDER_CONFIRMATION_HREF,
                params: { orderId: o.shopify_order_id },
              } as never)
            }>
            <Text style={styles.id}>#{o.shopify_order_id}</Text>
            <Text style={styles.meta}>
              {o.financial_status || 'paid'}
              {o.created_at ? ` · ${String(o.created_at).slice(0, 10)}` : ''}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={() => void Linking.openURL(TOUCHE_HOME_URL)} style={styles.shopifyLink}>
          <Text style={styles.link}>Manage refunds on Shopify →</Text>
        </Pressable>
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
    fontFamily: AppTokens.font.body,
    fontSize: 12,
    color: AppTokens.color.muted,
    marginBottom: 8,
  },
  content: { padding: 16, gap: 10 },
  empty: { color: AppTokens.color.muted, fontFamily: AppTokens.font.body },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  id: { fontFamily: AppTokens.font.body, fontWeight: '700', color: AppTokens.color.ink },
  meta: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  shopifyLink: { marginTop: 16, alignItems: 'center' },
  link: { color: AppTokens.color.brandBlue, fontFamily: AppTokens.font.body },
});
