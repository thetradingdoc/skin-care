/**
 * Daily check-in without photo — fail-closed against /api/patient/records/check-in.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';
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
    <SecondTierChrome testID="screen-track-checkin">
      <Pressable onPress={() => router.back()} testID="checkin-back" style={styles.back}>
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
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
      <TierPrimary
        label={busy ? 'Saving…' : 'Save'}
        testID="checkin-save"
        onPress={() => {
          if (!busy) void save();
        }}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginBottom: 8 },
  backLabel: { color: AppTokens.color.muted, fontWeight: '600' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: AppTokens.color.ink,
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    color: AppTokens.color.muted,
    lineHeight: 20,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: AppTokens.color.card,
    borderWidth: 1.5,
    borderColor: AppTokens.color.line,
  },
  chipOn: {
    backgroundColor: AppTokens.color.ink,
    borderColor: AppTokens.color.ink,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppTokens.color.ink,
  },
  chipTextOn: { color: '#FFFFFF' },
  err: { color: AppTokens.color.danger, fontSize: 13, marginBottom: 8 },
});
