/**
 * P7.06 — Thesis 6-lab (own variant — not a shared single-paragraph template).
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
export const THESIS_LAB_EYEBROW = 'saved';
export const THESIS_LAB_TITLE = 'Results kept as written';
export const THESIS_LAB_BODY = 'translation is coming — for now your document language stays intact.';

export default function ThesisLabScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-lab">
      <View>
        <Text style={styles.eye} testID="thesis-lab-eyebrow">{THESIS_LAB_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-lab-title">{THESIS_LAB_TITLE}</Text>
        <Text style={styles.body} testID="thesis-lab-body">{THESIS_LAB_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-lab-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
