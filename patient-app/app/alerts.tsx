/**
 * Step 31 — Alerts (mock frame 31).
 * Feed from GET /api/patient/alerts/feed (fallback /api/patient/alerts).
 * Claim-safe: no shop / verdict CTAs — reminders from own records only.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { settleAlertsFeed } from '@/lib/alerts-empty-policy';
import { patientGet } from '@/lib/patient-api';

type AlertRow = {
  id: string;
  kind?: string;
  severity?: string;
  title?: string;
  message?: string;
  product_id?: string | null;
};

function tagForKind(kind?: string): string {
  const k = String(kind || '').toLowerCase();
  if (k.includes('rx') || k.includes('prescription') || k.includes('refill')) return 'Prescription';
  if (k.includes('track') || k.includes('mark') || k.includes('photo')) return 'Tracking';
  if (k.includes('lab')) return 'Lab';
  if (k.includes('bill')) return 'Bill';
  if (k.includes('conflict') || k.includes('hard')) return 'Notice';
  return 'Reminder';
}

export default function AlertsScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [empty, setEmpty] = useState(false);
  const [seg, setSeg] = useState<'alerts' | 'history'>('alerts');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await patientGet('/api/patient/alerts/feed').catch(() =>
        patientGet('/api/patient/alerts').catch(() => null),
      );
      const list = data?.alerts ?? data?.items ?? [];
      const settled = settleAlertsFeed<AlertRow>(list);
      // P5.13 — autoRedirectTo is always null; empty renders in place (no bounce to Check)
      if (settled.autoRedirectTo != null) {
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
    if (ready) void load();
  }, [ready, load]);

  if (checking || !ready || loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={V4DesignTokens.color.red} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="alerts-screen">
      <View style={{ paddingHorizontal: 12 }}>
        <BackNavHeader
          label="Back"
          onBack={() => router.replace(PROGRESS_HREF)}
          testID="alerts-back-nav"
        />
      </View>
      {/* Legacy test id for older locks */}
      <View
        testID="alerts-back"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.legacyHidden}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.seg} testID="alerts-seg">
          <Pressable onPress={() => setSeg('alerts')} testID="alerts-seg-alerts">
            <Text style={[styles.segItem, seg === 'alerts' && styles.segOn]}>Alerts</Text>
          </Pressable>
          <Pressable onPress={() => setSeg('history')} testID="alerts-seg-history">
            <Text style={[styles.segItem, seg === 'history' && styles.segOn]}>History</Text>
          </Pressable>
        </View>

        <Text style={styles.title} testID="alerts-title">
          Alerts
        </Text>
        <Text style={styles.tagline} testID="alerts-tagline">
          Reminders from your own records — nothing generated.
        </Text>

        {empty || seg === 'history' ? (
          <View testID="alerts-empty">
            <Text style={styles.emptyTitle}>
              {seg === 'history' ? 'No history yet' : 'No alerts right now'}
            </Text>
            <Text style={styles.emptyBody}>
              {seg === 'history'
                ? 'Past reminders will show here when you have them.'
                : 'Reminders appear when your own Rx dates or tracking gaps need a nudge — nothing shop-generated.'}
            </Text>
            <Pressable onPress={() => router.replace(PROGRESS_HREF)} testID="alerts-go-progress">
              <Text style={styles.link}>Go to Progress</Text>
            </Pressable>
          </View>
        ) : (
          alerts.map((a) => (
            <View
              key={a.id}
              style={styles.card}
              testID={`alert-${a.id}`}
              accessibilityRole="text">
              <Text style={styles.tag} testID={`alert-tag-${a.id}`}>
                {tagForKind(a.kind)}
              </Text>
              <Text style={styles.cardTitle}>{a.title || a.kind || 'Alert'}</Text>
              {a.message ? <Text style={styles.cardMsg}>{a.message}</Text> : null}
              {/* Claim-safe lock: no shop / verdict CTA affordances on alert rows */}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  legacyHidden: { width: 0, height: 0, overflow: 'hidden' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  seg: {
    flexDirection: 'row',
    gap: 18,
    marginBottom: 4,
  },
  segItem: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  segOn: {
    color: V4DesignTokens.color.black,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  link: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.red,
  },
  card: {
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  tag: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    color: V4DesignTokens.color.red,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
  },
  cardMsg: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    lineHeight: 17,
  },
});
