/**
 * P7.06 — Thesis 6-skin (own variant — not a shared single-paragraph template).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const THESIS_SKIN_EYEBROW = 'day 1 recorded';
export const THESIS_SKIN_TITLE = 'Stop guessing about your skin';
export const THESIS_SKIN_BODY = "tomorrow's photo answers one question: same, calmer, or worse. that's it.";

export default function ThesisSkinScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-skin">
      <View>
        <Text style={styles.eye} testID="thesis-skin-eyebrow">{THESIS_SKIN_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-skin-title">{THESIS_SKIN_TITLE}</Text>
        <Text style={styles.body} testID="thesis-skin-body">{THESIS_SKIN_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-skin-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
