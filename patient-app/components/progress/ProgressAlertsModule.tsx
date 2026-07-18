/**
 * P7.31 — Progress Alerts module.
 * Consumes P5.13/P5.14 `/api/patient/alerts/feed` + settleAlertsFeed (no client aggregation).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import { ALERTS_HREF } from '@/constants/routes';
import { settleAlertsFeed } from '@/lib/alerts-empty-policy';
import { patientGet } from '@/lib/patient-api';
import { PROGRESS_ALERTS_FEED_API } from '@/lib/alerts-shelf-apis';

export { PROGRESS_ALERTS_FEED_API };

type AlertRow = {
  id: string;
  kind?: string;
  severity?: string;
  title?: string;
  message?: string;
};

export function ProgressAlertsModule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientGet(PROGRESS_ALERTS_FEED_API);
      const settled = settleAlertsFeed<AlertRow>(data?.alerts ?? data?.items);
      // P5.13 / P7.47 — never auto-redirect to Check
      if (settled.autoRedirectTo != null) {
        setEmpty(true);
        setAlerts([]);
        return;
      }
      setEmpty(settled.empty);
      setAlerts(settled.alerts);
    } catch {
      const settled = settleAlertsFeed([]);
      setEmpty(settled.empty);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.wrap} testID="progress-alerts-module">
        <ActivityIndicator color={AppTokens.color.fabBg} />
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.wrap} testID="progress-alerts-module">
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Alerts</Text>
          <Pressable onPress={() => router.push(ALERTS_HREF)} testID="progress-alerts-history">
            <Text style={styles.link}>History</Text>
          </Pressable>
        </View>
        <Text style={styles.empty} testID="progress-alerts-empty">
          No alerts right now
        </Text>
        {/* P7.47 lock: empty never auto-navigates — enforced in settleAlertsFeed + source tests */}
        <View testID="progress-alerts-no-redirect" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      </View>
    );
  }

  return (
    <View style={styles.wrap} testID="progress-alerts-module">
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Alerts</Text>
        <Pressable onPress={() => router.push(ALERTS_HREF)} testID="progress-alerts-history">
          <Text style={styles.link}>History</Text>
        </Pressable>
      </View>
      {alerts.slice(0, 5).map((a) => {
        const hard = a.severity === 'hard_no';
        return (
          <View
            key={a.id}
            style={[styles.card, hard && styles.cardHard]}
            testID={`progress-alert-${a.id}`}>
            <Text style={styles.cardTitle}>{a.title || a.kind || 'Alert'}</Text>
            {a.message ? <Text style={styles.cardBody}>{a.message}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', color: AppTokens.color.ink },
  link: { color: AppTokens.color.fabBg, fontWeight: '600', fontSize: 14 },
  empty: { fontSize: 15, color: AppTokens.color.muted },
  card: {
    backgroundColor: AppTokens.color.cardAmber,
    borderRadius: 12,
    padding: 12,
  },
  cardHard: { backgroundColor: AppTokens.color.cardRed },
  cardTitle: { fontSize: 15, fontWeight: '600', color: AppTokens.color.ink },
  cardBody: { fontSize: 13, color: AppTokens.color.muted, marginTop: 4 },
});
