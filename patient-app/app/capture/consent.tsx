/**
 * Step 2 — Consent (v4.1 SSOT). Word-for-word honesty cards + back-nav.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { ONBOARDING_WHY_HREF, WELCOME_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const ONBOARDING_CONSENT_TITLE = 'Before we start';
export const ONBOARDING_CONSENT_TAGLINE = 'A quick honesty note, not fine print.';
export const ONBOARDING_CONSENT_CONTINUE = 'I understand, continue';

export const CONSENT_CARDS = [
  {
    title: "We describe, we don't diagnose",
    body: 'AI notes what\'s visible in a photo. It never tells you what condition you have.',
  },
  {
    title: 'You confirm everything',
    body: 'Every AI read has a "looks right" and an edit — nothing saves without you.',
  },
  {
    title: 'Your photos stay yours',
    body: 'Encrypted, never sold, never used to train outside your account.',
  },
] as const;

/** Legacy long-form body kept for tests that import the constant. */
export const ONBOARDING_CONSENT_BODY = CONSENT_CARDS.map((c) => `${c.title}. ${c.body}`).join(' ');
export const ONBOARDING_CONSENT_MANUAL = 'Enter details manually instead';

export default function CaptureConsentScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} testID="capture-1-consent" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="consent-back"
        onBack={() => router.replace(WELCOME_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content} testID="capture-1-consent-scroll">
        <Text style={styles.title} testID="capture-consent-title">
          {ONBOARDING_CONSENT_TITLE}
        </Text>
        <Text style={styles.tagline} testID="capture-consent-tagline">
          {ONBOARDING_CONSENT_TAGLINE}
        </Text>
        {CONSENT_CARDS.map((card) => (
          <View key={card.title} style={styles.card} testID={`consent-card-${card.title.slice(0, 12)}`}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardBody}>{card.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="capture-consent-continue"
          accessibilityRole="button"
          onPress={() => router.push(ONBOARDING_WHY_HREF)}>
          <Text style={styles.ctaLabel}>{ONBOARDING_CONSENT_CONTINUE}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 24, gap: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
    backgroundColor: V4DesignTokens.color.white,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: V4DesignTokens.color.muted,
  },
  footer: { paddingBottom: 16 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
});
