/**
 * P7.06 — Thesis 6-mark (own variant — not a shared single-paragraph template).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

/**
 * These strings are hardcoded intentionally for claim-safety. If this screen is
 * ever wired to a dynamic data source (concern-routines.json, the routines API,
 * or similar), it MUST go through the same claim-safe projection layer used by
 * Plan Preview (/preview/claim-safe) — do not read raw expect/timeline strings here.
 */
export const THESIS_MARK_EYEBROW = 'saved';
export const THESIS_MARK_TITLE = "We'll help you compare it over time";
export const THESIS_MARK_BODY = 'each photo joins the same mark group — no guessing which bump was which.';

export default function ThesisMarkScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-mark">
      <View>
        <Text style={styles.eye} testID="thesis-mark-eyebrow">{THESIS_MARK_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-mark-title">{THESIS_MARK_TITLE}</Text>
        <Text style={styles.body} testID="thesis-mark-body">{THESIS_MARK_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-mark-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
