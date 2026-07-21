/**
 * Routine nudge — restyle only (clone Steps 3–4 why/plan chrome). Keep scoped.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF, ROUTINE_PICK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const ROUTINE_NUDGE_TITLE = 'Want reminders?';
export const ROUTINE_NUDGE_SUB =
  'optional — a routine just sets a reminder cadence, tracking works either way';

export default function RoutineNudgeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} testID="screen-10-routine-nudge" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="routine-nudge-back"
        onBack={() => router.replace(PROGRESS_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content}>
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
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="routine-nudge-start"
          onPress={() => router.push(ROUTINE_PICK_HREF)}
          accessibilityRole="button">
          <Text style={styles.primaryLabel}>Start with reminders</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          testID="routine-nudge-skip"
          onPress={() => router.replace(PROGRESS_HREF)}
          accessibilityRole="button">
          <Text style={styles.secondaryLabel}>no thanks, just let me log</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingBottom: 16 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 4,
  },
  footer: { paddingBottom: 12 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
