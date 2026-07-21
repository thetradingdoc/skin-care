/**
 * PIH v2 — Export / PDF report for dermatologist (design ID: export).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { EXPORT_FAIL_HREF, EXPORT_GATED_HREF, MARK_PICKER_HREF, PROGRESS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { fetchMarksList } from '@/lib/marks-api';
import { patientPost } from '@/lib/patient-api';

export const EXPORT_TITLE = 'Report for your dermatologist';
export const EXPORT_DISC =
  'Patient-confirmed photo log, not a diagnosis. Reflects what you entered.';

export default function ExportScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [photoCount, setPhotoCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { marks } = await fetchMarksList();
      // Sum server photo_count (1 per mark fact with media). No mark-id proxy.
      const count = Array.isArray(marks)
        ? marks.reduce((acc, m) => acc + (Number(m.photo_count) || 0), 0)
        : 0;
      setPhotoCount(count);
      if (count < 2) {
        router.replace(EXPORT_GATED_HREF);
      }
    } catch {
      setPhotoCount(0);
      router.replace(EXPORT_GATED_HREF);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareLink = async () => {
    setBusy(true);
    try {
      await patientPost('/api/patient/share/doctor-link', {});
      // Success path — share-with-doctor handles real link; failure → fail screen
    } catch {
      router.push(EXPORT_FAIL_HREF);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ActivityIndicator color={V4DesignTokens.color.red} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} testID="screen-export" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROGRESS_HREF)} />
      <View style={styles.body}>
        <Text style={styles.title} testID="export-title">
          {EXPORT_TITLE}
        </Text>
        <View style={styles.card}>
          <Text style={styles.line}>
            <Text style={styles.bold}>Photos:</Text> {photoCount} logged for compare
          </Text>
          <Text style={styles.line}>
            <Text style={styles.bold}>Protocol:</Text> From your habit checklist (AM / PM)
          </Text>
          <Text style={styles.disc}>{EXPORT_DISC}</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="export-generate-pdf"
          onPress={() => router.push('/profile/share-with-doctor' as never)}>
          <Text style={styles.ctaLabel}>Generate PDF</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="export-share-link"
          disabled={busy}
          onPress={() => void shareLink()}>
          <Text style={styles.secondaryLabel}>Share link · expires in 7 days</Text>
        </Pressable>
        <Pressable onPress={() => router.push(MARK_PICKER_HREF)}>
          <Text style={styles.skip}>Log another photo</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 12, gap: 14 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.wine,
  },
  card: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
    gap: 6,
  },
  line: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  bold: { fontFamily: V4DesignTokens.font.bodyBold, color: V4DesignTokens.color.wine },
  disc: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 11,
    color: V4DesignTokens.color.muted,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: V4DesignTokens.color.line,
    lineHeight: 16,
  },
  footer: { padding: 22, gap: 10 },
  cta: {
    backgroundColor: V4DesignTokens.color.wine,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
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
  skip: {
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 4,
  },
});
