/**
 * P7.06 — Thesis 6-other (own variant — not a shared single-paragraph template).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const THESIS_OTHER_EYEBROW = 'saved';
export const THESIS_OTHER_TITLE = 'Logged for later';
export const THESIS_OTHER_BODY = "it's on your calendar so you can find it when you need it.";

export default function ThesisOtherScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-other">
      <View>
        <Text style={styles.eye} testID="thesis-other-eyebrow">{THESIS_OTHER_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-other-title">{THESIS_OTHER_TITLE}</Text>
        <Text style={styles.body} testID="thesis-other-body">{THESIS_OTHER_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-other-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
