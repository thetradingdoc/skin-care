/**
 * Step 20 — Thesis 6-skin (v4.1 frame 20). Claim-safe: habits, not promises.
 * Own variant — not a shared single-paragraph template.
 * Exact approved copy must stay in sync with design-parity assertions.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { PROGRESS_HREF, TRACK_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

/**
 * These strings are hardcoded intentionally for claim-safety. If this screen is
 * ever wired to a dynamic data source (concern-routines.json, the routines API,
 * or similar), it MUST go through the same claim-safe projection layer used by
 * Plan Preview (/preview/claim-safe) — do not read raw expect/timeline strings here.
 *
 * Approved claim-safe strings — assert presence in design-parity suite.
 */
export const THESIS_SKIN_TITLE = 'What this typically involves';
export const THESIS_SKIN_TAGLINE = 'Habits, not promises.';
export const THESIS_SKIN_HONESTY =
  "No timeline is promised — everyone's skin responds differently, and this isn't a treatment plan.";

export const THESIS_SKIN_CARD_SUN_TAG = 'Sun exposure';
export const THESIS_SKIN_CARD_SUN_TITLE = 'SPF matters here';
export const THESIS_SKIN_CARD_SUN_BODY =
  "Unprotected sun can darken this area further while it's healing.";

export const THESIS_SKIN_CARD_CONSISTENCY_TAG = 'Consistency';
export const THESIS_SKIN_CARD_CONSISTENCY_TITLE = 'Log weekly, same light';
export const THESIS_SKIN_CARD_CONSISTENCY_BODY =
  'Small changes are easier to see when captures are consistent.';

/** @deprecated Kept for import stability; title is the claim-safe SSOT. */
export const THESIS_SKIN_EYEBROW = THESIS_SKIN_TAGLINE;
/** @deprecated Prefer THESIS_SKIN_HONESTY / cards. */
export const THESIS_SKIN_BODY = THESIS_SKIN_HONESTY;

export default function ThesisSkinScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="thesis-6-skin" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="thesis-skin-back"
        onBack={() => router.replace(TRACK_HREF as never)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="thesis-skin-title">
          {THESIS_SKIN_TITLE}
        </Text>
        <Text style={styles.tagline} testID="thesis-skin-tagline">
          {THESIS_SKIN_TAGLINE}
        </Text>

        <View style={styles.card} testID="thesis-skin-card-sun">
          <Text style={styles.cardTag}>{THESIS_SKIN_CARD_SUN_TAG}</Text>
          <Text style={styles.cardTitle}>{THESIS_SKIN_CARD_SUN_TITLE}</Text>
          <Text style={styles.cardBody}>{THESIS_SKIN_CARD_SUN_BODY}</Text>
        </View>
        <View style={styles.card} testID="thesis-skin-card-consistency">
          <Text style={styles.cardTag}>{THESIS_SKIN_CARD_CONSISTENCY_TAG}</Text>
          <Text style={styles.cardTitle}>{THESIS_SKIN_CARD_CONSISTENCY_TITLE}</Text>
          <Text style={styles.cardBody}>{THESIS_SKIN_CARD_CONSISTENCY_BODY}</Text>
        </View>

        <Text style={styles.honesty} testID="thesis-skin-honesty">
          {THESIS_SKIN_HONESTY}
        </Text>
      </ScrollView>
      <Pressable
        style={styles.cta}
        testID="thesis-skin-continue"
        onPress={() => router.replace(PROGRESS_HREF)}
        accessibilityRole="button"
        accessibilityLabel="Continue">
        <Text style={styles.ctaLabel}>Continue</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 8, paddingBottom: 16 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
    marginBottom: 10,
    backgroundColor: V4DesignTokens.color.white,
  },
  cardTag: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 11,
    letterSpacing: 0.4,
    color: V4DesignTokens.color.redDeep,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: V4DesignTokens.color.muted,
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    lineHeight: 19,
    color: V4DesignTokens.color.muted,
    marginTop: 8,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
});
