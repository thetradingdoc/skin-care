/**
 * P7.11 — Welcome copy: 20 AI reads free each month (marketing / onboarding welcome).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { CAPTURE_CONSENT_HREF, SIGN_IN_HREF } from '@/constants/routes';

export const WELCOME_BRAND = 'touche';
export const WELCOME_TAGLINE = 'Be Bold';
export const WELCOME_SUBTITLE = 'Skincare & medical journal';
export const WELCOME_PRODUCT = 'Medical Tracker';
export const WELCOME_AI_READS =
  '20 AI reads free each month — manual entries are always free.';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SecondTierChrome testID="screen-welcome">
      <View>
        <Text style={styles.brand} testID="welcome-brand">
          {WELCOME_BRAND}
        </Text>
        <Text style={styles.tagline} testID="welcome-be-bold">
          {WELCOME_TAGLINE}
        </Text>
        <Text style={styles.subtitle} testID="welcome-subtitle">
          {WELCOME_SUBTITLE}
        </Text>
        <Text style={styles.product}>{WELCOME_PRODUCT}</Text>
        <Text style={styles.body}>
          One place for your skin, your prescriptions, your bills — whatever you need to keep track
          of.
        </Text>
        <Text style={styles.ai} testID="welcome-20-ai-reads">
          {WELCOME_AI_READS}
        </Text>
      </View>
      <View>
        <TierPrimary
          label="Get started"
          testID="welcome-get-started"
          onPress={() => router.push(CAPTURE_CONSENT_HREF)}
        />
        <Text style={styles.hint} onPress={() => router.push(SIGN_IN_HREF)}>
          free, always for manual entries
        </Text>
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 18, fontWeight: '600', color: AppTokens.color.muted, marginBottom: 4 },
  tagline: { fontSize: 28, fontWeight: '700', color: AppTokens.color.ink, marginBottom: 4 },
  subtitle: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 12 },
  product: { fontSize: 22, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted, marginBottom: 16 },
  ai: { fontSize: 15, fontWeight: '600', color: AppTokens.color.fabBg },
  hint: { textAlign: 'center', color: AppTokens.color.muted, marginTop: 12 },
});
