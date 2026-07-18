/**
 * P7.07 — Daily T5b AI SUGGESTS on authenticated Track loop.
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const DAILY_AI_SUGGESTS_LABEL = 'AI SUGGESTS:';
export const DAILY_DELTAS = ['worse', 'same', 'calmer'] as const;

export default function DailyAiSuggestsScreen() {
  const router = useRouter();
  const [delta, setDelta] = useState<(typeof DAILY_DELTAS)[number]>('calmer');
  const [used, setUsed] = useState('');

  return (
    <SecondTierChrome testID="screen-t5b-daily-ai-suggests">
      <View>
        <Text style={styles.ai} testID="daily-ai-suggests-label">
          {DAILY_AI_SUGGESTS_LABEL} {delta} than yesterday
        </Text>
        <Text style={styles.sub}>tap to confirm or correct</Text>
        <View style={styles.row}>
          {DAILY_DELTAS.map((d) => (
            <Pressable
              key={d}
              style={[styles.chip, delta === d && styles.chipOn]}
              onPress={() => setDelta(d)}
              testID={`daily-delta-${d}`}>
              <Text style={styles.chipLabel}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.q}>what did you use today? (optional)</Text>
        <TextInput
          style={styles.input}
          value={used}
          onChangeText={setUsed}
          placeholder="niacinamide"
          testID="daily-products-used"
        />
      </View>
      <TierPrimary
        label="looks right"
        testID="daily-looks-right"
        onPress={() => router.replace(PROGRESS_HREF)}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  ai: { fontSize: 20, fontWeight: '700', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: AppTokens.color.cream,
  },
  chipOn: { backgroundColor: AppTokens.color.infoBlue },
  chipLabel: { fontWeight: '600', color: AppTokens.color.ink },
  q: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 12,
  },
});
