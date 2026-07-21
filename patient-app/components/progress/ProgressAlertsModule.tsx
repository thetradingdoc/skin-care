/**
 * P7.31 — Progress Alerts module (entry + preview).
 * Consumes `/api/patient/alerts/feed` + settleAlertsFeed (no client aggregation).
 * Claim-safe: no shop / verdict CTAs.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ALERTS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
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
        <ActivityIndicator color={V4DesignTokens.color.red} />
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
        <View
          testID="progress-alerts-no-redirect"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
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
      {alerts.slice(0, 3).map((a) => (
        <View key={a.id} style={styles.card} testID={`progress-alert-${a.id}`}>
          <Text style={styles.cardTitle}>{a.title || a.kind || 'Alert'}</Text>
          {a.message ? <Text style={styles.cardBody}>{a.message}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8, gap: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  link: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    color: V4DesignTokens.color.red,
    fontSize: 14,
  },
  empty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
  card: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 4,
  },
});
