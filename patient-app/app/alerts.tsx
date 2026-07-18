/**
 * P5.13 — Alerts are Progress module + Shelf badge + push — not a dedicated tab home.
 * Empty state no longer redirects to Check (retired P7.47 dependency).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import { CAPTURE_2A_HREF, PROGRESS_HREF, SHOP_HREF, verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { settleAlertsFeed } from '@/lib/alerts-empty-policy';
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
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, status] = await Promise.all([
        patientGet('/api/patient/alerts/feed').catch(() =>
          patientGet('/api/patient/alerts').catch(() => null),
        ),
        patientGet('/api/patient/commerce/status').catch(() => null),
      ]);
      if (status?.commerce_ctas_enabled) setCommerceOn(true);
      const settled = settleAlertsFeed(data?.alerts);
      // P5.13 — autoRedirectTo is always null; empty renders in place (no bounce to Check)
      if (settled.autoRedirectTo != null) {
        // Defensive: policy forbids this; never navigate from settle
        setEmpty(true);
        setAlerts([]);
        return;
      }
      if (settled.empty) {
        setEmpty(true);
        setAlerts([]);
        return;
      }
      setEmpty(false);
      setAlerts(settled.alerts as AlertRow[]);
    } catch {
      // Error path also stays on this screen — no Check redirect
      const settled = settleAlertsFeed([]);
      setEmpty(settled.empty);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
        <Pressable onPress={() => router.replace(PROGRESS_HREF)} testID="alerts-back">
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Alerts</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {empty ? (
          <View testID="alerts-empty">
            <Text style={styles.emptyTitle}>No alerts right now</Text>
            <Text style={styles.emptyBody}>
              Conflicts and reminders show on Progress and as Shelf badges — there is no separate alerts home.
            </Text>
            <Pressable onPress={() => router.replace(PROGRESS_HREF)} testID="alerts-go-progress">
              <Text style={styles.link}>Go to Progress</Text>
            </Pressable>
            <Pressable onPress={() => router.replace(CAPTURE_2A_HREF)} testID="alerts-go-check">
              <Text style={styles.linkSecondary}>Open Check</Text>
            </Pressable>
          </View>
        ) : (
          alerts.map((a) => {
            const hard = a.severity === 'hard_no';
            return (
              <Pressable
                key={a.id}
                style={[styles.card, hard && styles.cardHard]}
                onPress={() => {
                  if (a.product_id && commerceOn) router.push(verdictHref(a.product_id));
                  else if (a.kind === 'hard_no' || a.kind === 'conflict') router.push(SHOP_HREF);
                  else router.replace(PROGRESS_HREF);
                }}
                testID={`alert-${a.id}`}
              >
                <Text style={[styles.cardTitle, hard && styles.cardTitleHard]}>{a.title}</Text>
                <Text style={styles.cardMsg}>{a.message}</Text>
              </Pressable>
            );
          })
        )}
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
    paddingVertical: 12,
  },
  back: { color: AppTokens.color.fabBg, fontSize: 16, width: 48 },
  title: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink },
  content: { padding: 16, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  emptyBody: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16, lineHeight: 22 },
  link: { color: AppTokens.color.fabBg, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  linkSecondary: { color: AppTokens.color.muted, fontSize: 15 },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: AppTokens.color.card,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
  },
  cardHard: { borderColor: AppTokens.color.hardNo },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppTokens.color.ink },
  cardTitleHard: { color: AppTokens.color.hardNo },
  cardMsg: { marginTop: 4, fontSize: 14, color: AppTokens.color.muted },
});
