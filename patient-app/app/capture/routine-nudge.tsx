/**
 * P7.37 — Screen 10 routine nudge (skin-only, one-time, skippable).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF, ROUTINE_PICK_HREF } from '@/constants/routes';

export const ROUTINE_NUDGE_TITLE = 'Want reminders?';
export const ROUTINE_NUDGE_SUB =
  'optional — a routine just sets a reminder cadence, tracking works either way';

export default function RoutineNudgeScreen() {
  const router = useRouter();

  return (
    <SecondTierChrome testID="screen-10-routine-nudge">
      <View>
        <Text style={styles.title} testID="routine-nudge-title">
          {ROUTINE_NUDGE_TITLE}
        </Text>
        <Text style={styles.sub}>{ROUTINE_NUDGE_SUB}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Acne</Text>
          <Text style={styles.cardBody}>12 weeks · daily reminder</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Barrier repair</Text>
          <Text style={styles.cardBody}>8 weeks · daily reminder</Text>
        </View>
      </View>
      <View>
        <TierPrimary
          label="Start with reminders"
          testID="routine-nudge-start"
          onPress={() => router.push(ROUTINE_PICK_HREF)}
        />
        <TierSecondary
          label="no thanks, just let me log"
          testID="routine-nudge-skip"
          onPress={() => router.replace(PROGRESS_HREF)}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16, lineHeight: 22 },
  card: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppTokens.color.ink },
  cardBody: { fontSize: 13, color: AppTokens.color.muted, marginTop: 4 },
});
