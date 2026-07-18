/**
 * P7.06 — Thesis 6-bill (own variant — not a shared single-paragraph template).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const THESIS_BILL_EYEBROW = 'saved';
export const THESIS_BILL_TITLE = 'One less thing to remember';
export const THESIS_BILL_BODY = "it's already in your calendar. next time, snap it before you file it away.";

export default function ThesisBillScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="thesis-6-bill">
      <View>
        <Text style={styles.eye} testID="thesis-bill-eyebrow">{THESIS_BILL_EYEBROW}</Text>
        <Text style={styles.title} testID="thesis-bill-title">{THESIS_BILL_TITLE}</Text>
        <Text style={styles.body} testID="thesis-bill-body">{THESIS_BILL_BODY}</Text>
      </View>
      <TierPrimary label="Continue" testID="thesis-bill-continue" onPress={() => router.replace(PROGRESS_HREF)} />
    </SecondTierChrome>
  );
}
const styles = StyleSheet.create({
  eye: { fontSize: 13, color: AppTokens.color.muted, marginBottom: 8, textTransform: 'lowercase' },
  title: { fontSize: 28, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
