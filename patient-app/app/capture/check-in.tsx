/**
 * PIH v2 — Daily check-in without photo (design ID: track-checkin).
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import {
  feelingSlugFromLabel,
  performCheckInSave,
} from '@/lib/daily-check-in';

const OPTIONS = ['Calmer', 'About the same', 'Worse'] as const;

export const CHECKIN_TITLE = 'Quick check-in';
export const CHECKIN_SUB = 'How does it look today? No photo needed.';

export default function TrackCheckInScreen() {
  const router = useRouter();
  const [sel, setSel] = useState<(typeof OPTIONS)[number]>('About the same');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await performCheckInSave({
        feeling: feelingSlugFromLabel(sel),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(PROGRESS_HREF);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-track-checkin" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.back()} />
      <View style={styles.body}>
        <Text style={styles.title}>{CHECKIN_TITLE}</Text>
        <Text style={styles.sub}>{CHECKIN_SUB}</Text>
        <View style={styles.chips}>
          {OPTIONS.map((o) => (
            <Pressable
              key={o}
              onPress={() => setSel(o)}
              style={[styles.chip, sel === o && styles.chipOn]}
              testID={`checkin-chip-${o}`}>
              <Text style={[styles.chipText, sel === o && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          ))}
        </View>
        {error ? (
          <Text style={styles.err} testID="checkin-error">
            {error}
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Pressable
          style={[styles.cta, busy && { opacity: 0.6 }]}
          disabled={busy}
          testID="checkin-save"
          onPress={() => void save()}>
          <Text style={styles.ctaLabel}>Save</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 22, paddingTop: 18, gap: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 20,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(61,0,11,0.06)',
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
  },
  chipOn: {
    backgroundColor: V4DesignTokens.color.wine,
    borderColor: V4DesignTokens.color.wine,
  },
  chipText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.wine,
  },
  chipTextOn: { color: V4DesignTokens.color.white },
  err: { color: V4DesignTokens.color.red, fontSize: 13 },
  footer: { padding: 22 },
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
});
