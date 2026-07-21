/**
 * PIH v2 — Protocol detail (design ID: profile-protocol). Claim-safe habits only.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { patientGet } from '@/lib/patient-api';

export default function ProfileProtocolScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [am, setAm] = useState('Vitamin C · Niacinamide · SPF');
  const [pm, setPm] = useState('Niacinamide · Retinol');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await patientGet('/api/patient/routine/template');
        if (cancelled) return;
        const slots = data?.template?.slots || data?.slots;
        if (Array.isArray(slots)) {
          const morning = slots.find((s: { name?: string }) => /morning|am/i.test(String(s.name || '')));
          const evening = slots.find((s: { name?: string }) => /evening|pm/i.test(String(s.name || '')));
          if (morning?.steps) {
            setAm(
              (morning.steps as { product_name?: string }[])
                .map((x) => x.product_name)
                .filter(Boolean)
                .join(' · ') || am,
            );
          }
          if (evening?.steps) {
            setPm(
              (evening.steps as { product_name?: string }[])
                .map((x) => x.product_name)
                .filter(Boolean)
                .join(' · ') || pm,
            );
          }
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.root} testID="screen-profile-protocol" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROFILE_HREF)} />
      <View style={styles.body}>
        <Text style={styles.title}>Your protocol</Text>
        {loading ? <ActivityIndicator color={V4DesignTokens.color.red} /> : null}
        <View style={styles.card}>
          <Text style={styles.ph}>Morning</Text>
          <Text style={styles.pl}>{am}</Text>
          <Text style={[styles.ph, { marginTop: 12 }]}>Evening</Text>
          <Text style={styles.pl}>{pm}</Text>
        </View>
        <Text style={styles.note}>Habit checklist only — not medical treatment.</Text>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.secondary} onPress={() => router.push('/routine/pick' as never)}>
          <Text style={styles.secondaryLabel}>Edit protocol</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 8, gap: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.wine,
  },
  card: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    padding: 16,
  },
  ph: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    color: V4DesignTokens.color.green,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  pl: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.wine,
  },
  note: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
  },
  footer: { padding: 22 },
  secondary: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.wine,
  },
});
