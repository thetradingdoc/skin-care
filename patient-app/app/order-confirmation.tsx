/**
 * TOUCH-077–079 / 083 — Screen 18/19 order confirmation + honest evaluate result.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { CHECK_HREF, SCAN_HREF, verdictHref } from '@/constants/routes';
import { useRequirePatientSession } from '@/hooks/useRequirePatientSession';
import { patientGet } from '@/lib/patient-api';

export default function OrderConfirmationScreen() {
  const { ready, checking } = useRequirePatientSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [loading, setLoading] = useState(true);
  const [shelfCount, setShelfCount] = useState(0);
  const [overall, setOverall] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState(0);
  const [firstShelfId, setFirstShelfId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      setLoading(true);
      try {
        if (params.orderId) {
          const detail = await patientGet(`/api/patient/orders/${encodeURIComponent(String(params.orderId))}`);
          const lines = Array.isArray(detail?.lines) ? detail.lines : [];
          const shelfIds = lines.map((l: { shelf_product_id?: string }) => l.shelf_product_id).filter(Boolean);
          setShelfCount(shelfIds.length);
          if (shelfIds[0]) setFirstShelfId(String(shelfIds[0]));
        }
        const evalRes = await patientGet('/api/patient/routine/evaluate').catch(() => null);
        if (evalRes) {
          setOverall(String(evalRes.overall || ''));
          setConflictCount(Array.isArray(evalRes.conflicts) ? evalRes.conflicts.length : 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, params.orderId]);

  if (checking || !ready || loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator style={{ marginTop: 48 }} color={AppTokens.color.fabBg} />
      </SafeAreaView>
    );
  }

  const noConflicts = conflictCount === 0 && (overall === 'safe' || !overall);
  const evalCopy = noConflicts ? COMMERCE_COPY.confirmNoConflicts : COMMERCE_COPY.confirmHasConflicts;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner} testID="order-confirmation">
        <Text style={styles.title}>{COMMERCE_COPY.confirmTitle}</Text>
        <Text style={styles.body}>{COMMERCE_COPY.confirmBody}</Text>
        {shelfCount > 0 ? (
          <Text style={styles.ok} testID="order-shelf-added">
            {COMMERCE_COPY.confirmShelfAdded} ({shelfCount})
          </Text>
        ) : (
          <Text style={styles.muted}>Shelf update pending map match.</Text>
        )}
        <Text
          style={[styles.eval, noConflicts ? styles.evalOk : styles.evalWarn]}
          testID="order-evaluate-truth">
          {evalCopy}
        </Text>
        <Text style={styles.muted}>{COMMERCE_COPY.confirmRefunds}</Text>

        <View style={styles.actions}>
          {firstShelfId ? (
            <Pressable
              style={styles.primary}
              onPress={() => router.push(verdictHref(firstShelfId))}
              testID="order-open-verdict">
              <Text style={styles.primaryText}>Review verdict</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={() => router.push(SCAN_HREF)}>
              <Text style={styles.primaryText}>Open shelf</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.replace(CHECK_HREF)}>
            <Text style={styles.link}>Back to Check</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  inner: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontFamily: AppTokens.font.display, fontSize: 26, color: AppTokens.color.ink },
  body: { fontFamily: AppTokens.font.body, fontSize: 15, color: AppTokens.color.ink, lineHeight: 22 },
  ok: { fontFamily: AppTokens.font.body, fontWeight: '600', color: AppTokens.color.safe },
  eval: { fontFamily: AppTokens.font.body, fontSize: 15, fontWeight: '600' },
  evalOk: { color: AppTokens.color.safe },
  evalWarn: { color: AppTokens.color.terracotta },
  muted: { fontFamily: AppTokens.font.body, fontSize: 13, color: AppTokens.color.muted },
  actions: { gap: 14, marginTop: 16 },
  primary: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700' },
  link: { textAlign: 'center', color: AppTokens.color.ink, textDecorationLine: 'underline' },
});
