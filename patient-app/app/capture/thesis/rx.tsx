/**
 * P7.06 — Thesis 6-rx (own variant — not a shared single-paragraph template).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const THESIS_RX_EYEBROW = 'saved';
export const THESIS_RX_TITLE = 'Never miss a refill again';
export const THESIS_RX_BODY = "we'll remind you before this one expires. that's the whole job.";

export default function ThesisRxScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-rx">
      <View>
        <Text style={styles.eye} testID="thesis-rx-eyebrow">{THESIS_RX_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-rx-title">{THESIS_RX_TITLE}</Text>
        <Text style={styles.body} testID="thesis-rx-body">{THESIS_RX_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-rx-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
