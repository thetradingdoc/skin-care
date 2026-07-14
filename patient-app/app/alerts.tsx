/**
 * TOUCH-066 / TOUCH-067 — Alerts surface (hard-no louder than caution).
 * Only opened when count > 0 (TOUCH-068 routes from Check).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import { CHECK_HREF, SHOP_HREF, verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { fetchPatientAlerts } from '@/lib/conflict-api';
import { patientGet } from '@/lib/patient-api';

type AlertRow = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  message: string;
  product_id?: string | null;
};

export default function AlertsScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, status] = await Promise.all([
        fetchPatientAlerts(),
        patientGet('/api/patient/commerce/status').catch(() => null),
      ]);
      if (status?.commerce_ctas_enabled) setCommerceOn(true);
      const list = Array.isArray(data?.alerts) ? data.alerts : [];
      if (!list.length) {
        router.replace(CHECK_HREF);
        return;
      }
      setAlerts(list);
    } catch {
      router.replace(CHECK_HREF);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (checking || !ready || loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={AppTokens.color.fabBg} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={() => router.replace(CHECK_HREF)} testID="alerts-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Alerts</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {alerts.map((a) => {
          const hard = a.severity === 'hard_no';
          return (
            <Pressable
              key={a.id}
              style={[styles.card, hard ? styles.cardHardNo : styles.cardCaution]}
              testID={hard ? 'alert-card-hard-no' : 'alert-card-caution'}
              onPress={() => {
                if (a.product_id) router.push(verdictHref(String(a.product_id)));
              }}>
              <Text style={[styles.cardTitle, hard && styles.cardTitleHard]}>{a.title}</Text>
              <Text style={styles.cardBody}>{a.message}</Text>
            </Pressable>
          );
        })}
        {commerceOn ? (
          <Pressable style={styles.shopCta} onPress={() => router.push(SHOP_HREF)} testID="alerts-shop">
            <Text style={styles.shopCtaText}>Find a safer swap in Shop →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  back: { fontFamily: AppTokens.font.body, color: AppTokens.color.ink, fontSize: 15 },
  title: { fontFamily: AppTokens.font.display, fontSize: 18, color: AppTokens.color.ink },
  content: { padding: 16, gap: 12 },
  card: {
    borderRadius: AppTokens.radius.md,
    padding: 14,
    borderLeftWidth: 4,
  },
  cardHardNo: {
    backgroundColor: '#FDECEC',
    borderLeftColor: AppTokens.color.hardNo,
  },
  cardCaution: {
    backgroundColor: '#F8EDE7',
    borderLeftColor: AppTokens.color.terracotta,
  },
  cardTitle: {
    fontFamily: AppTokens.font.body,
    fontWeight: '700',
    fontSize: 15,
    color: AppTokens.color.ink,
    marginBottom: 4,
  },
  cardTitleHard: { color: AppTokens.color.hardNo, fontSize: 16 },
  cardBody: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  shopCta: { paddingVertical: 12, alignItems: 'center' },
  shopCtaText: {
    fontFamily: AppTokens.font.body,
    fontWeight: '600',
    color: AppTokens.color.fabBg,
    textDecorationLine: 'underline',
  },
});
