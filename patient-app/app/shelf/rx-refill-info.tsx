/**
 * P7.43 / Step 28 — Rx refill info (real screen — not a dead button).
 * Hard rule: no Buy / purchase / checkout CTA under any condition.
 * Locked copy: touche never sells or refills prescription medication.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { SHELF_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { SHELF_RX_BADGE, SHELF_RX_REFILL_CTA } from '@/lib/phase5-ui-copy';

export const RX_REFILL_TITLE = 'Need a refill?';
export const RX_REFILL_CTA = SHELF_RX_REFILL_CTA;
export const RX_REFILL_NEVER =
  'touche never sells or refills prescription medication';
export const RX_REFILL_BODY =
  "We'll help you request one from your pharmacy — no marketplace, no checkout.";

export default function RxRefillInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ drug?: string; expires?: string }>();
  const drug = String(params.drug || 'Your prescription').trim();
  const expires = String(params.expires || '').trim();

  return (
    <SafeAreaView style={styles.root} testID="screen-rx-refill-info" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="rx-refill-back-nav"
        onBack={() => router.replace(SHELF_HREF)}
      />
      <View style={styles.main}>
        <Text style={styles.drug} testID="rx-refill-drug">
          {drug}
        </Text>
        {expires ? (
          <Text style={styles.meta} testID="rx-refill-expires">
            expires {expires}
          </Text>
        ) : null}
        <Text style={styles.badge} testID="rx-refill-badge">
          {SHELF_RX_BADGE}
        </Text>
        <View style={styles.card}>
          <Text style={styles.title} testID="rx-refill-title">
            {RX_REFILL_TITLE}
          </Text>
          <Text style={styles.body} testID="rx-refill-contact">
            {RX_REFILL_BODY}
          </Text>
        </View>
        <Text style={styles.never} testID="rx-refill-never-sells">
          {RX_REFILL_NEVER}
        </Text>
      </View>
      <Pressable
        style={styles.cta}
        testID="rx-refill-back"
        onPress={() => router.replace(SHELF_HREF)}
        accessibilityRole="button"
        accessibilityLabel="Back to Shelf">
        <Text style={styles.ctaLabel}>Back to Shelf</Text>
      </Pressable>
      {/* Explicit: this screen never mounts a Buy/purchase control. */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  main: { flex: 1, paddingTop: 8 },
  drug: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  meta: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 10,
  },
  badge: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: V4DesignTokens.color.redDeep,
    marginBottom: 14,
  },
  card: {
    borderWidth: 1,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 20,
  },
  never: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.redDeep,
    backgroundColor: '#FCEBEB',
    padding: 12,
    borderRadius: 10,
    lineHeight: 20,
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
