/**
 * Step 1 — Welcome (PIH v2 / Skiñcare).
 * Ground background, brand lockup, Be bold., claim-safe body (no “clear in 12 weeks”).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToucheTulipMark } from '@/components/v4/ToucheTulipMark';
import { CAPTURE_CONSENT_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

export const WELCOME_BRAND = 'skiñcare';
export const WELCOME_TAGLINE = 'Be bold.';
export const WELCOME_HEADLINE = 'Track your skin & care';
export const WELCOME_BODY =
  'Photos help you track — you confirm every entry. Not a diagnosis, not live clinician review.';
export const WELCOME_CTA = 'Get started';

/** @deprecated Prefer WELCOME_HEADLINE — kept for existing tests. */
export const WELCOME_SUBTITLE = WELCOME_HEADLINE;
/** @deprecated Prefer WELCOME_BODY */
export const WELCOME_PRODUCT = 'Medical Tracker';
/** @deprecated Removed from Welcome copy */
export const WELCOME_AI_READS =
  '20 AI reads free each month — manual entries are always free.';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="screen-welcome" edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <View style={styles.topPad} />
        <View style={styles.lockup} testID="welcome-lockup">
          <ToucheTulipMark color={V4DesignTokens.color.red} width={56} testID="welcome-tulip" />
        </View>
        <Text style={styles.brand} testID="welcome-brand">
          {WELCOME_BRAND}
        </Text>
        <Text style={styles.tagline} testID="welcome-be-bold">
          {WELCOME_TAGLINE}
        </Text>
        <Text style={styles.headline} testID="welcome-headline">
          {WELCOME_HEADLINE}
        </Text>
        <Text style={styles.body} testID="welcome-body">
          {WELCOME_BODY}
        </Text>
        <Pressable
          style={styles.cta}
          testID="welcome-get-started"
          accessibilityRole="button"
          accessibilityLabel="Get started"
          onPress={() => router.push(CAPTURE_CONSENT_HREF)}>
          <Text style={styles.ctaLabel}>{WELCOME_CTA}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V4DesignTokens.color.ground,
  },
  hero: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topPad: { flex: 0.35 },
  lockup: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brand: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 26,
    color: V4DesignTokens.color.wine,
    marginBottom: 4,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: V4DesignTokens.color.red,
    marginBottom: 18,
  },
  headline: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    lineHeight: 21,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 28,
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: V4DesignTokens.color.wine,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
});
