/**
 * P7.17 — Welcome bonus T7 interstitial.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { PROGRESS_HREF } from '@/constants/routes';

export const WELCOME_BONUS_TITLE = 'Catching up? Extra reads on us';
export const WELCOME_BONUS_BODY =
  "for your first week, backfilling old records doesn't touch your monthly limit";

export default function WelcomeBonusScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="screen-t7-welcome-bonus">
      <View>
        <Text style={styles.title} testID="welcome-bonus-title">
          {WELCOME_BONUS_TITLE}
        </Text>
        <Text style={styles.body}>{WELCOME_BONUS_BODY}</Text>
        <Text style={styles.meta} testID="welcome-bonus-meta">
          12 bonus reads · 5 days left
        </Text>
      </View>
      <TierPrimary
        label="Got it"
        testID="welcome-bonus-got-it"
        onPress={() => router.replace(PROGRESS_HREF)}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted, marginBottom: 12 },
  meta: { fontSize: 14, fontWeight: '600', color: AppTokens.color.fabBg },
});
