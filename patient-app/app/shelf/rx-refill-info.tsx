/**
 * P7.43 — Rx refill info destination (real screen — not a dead button).
 * Locked copy: touche never sells or refills prescription medication.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { SHELF_HREF } from '@/constants/routes';

export const RX_REFILL_TITLE = 'Refill info';
export const RX_REFILL_CTA = 'refill info — contact your prescriber';
export const RX_REFILL_NEVER =
  'touche never sells or refills prescription medication';

export default function RxRefillInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ drug?: string; expires?: string }>();
  const drug = String(params.drug || 'Your prescription').trim();
  const expires = String(params.expires || '').trim();

  return (
    <SecondTierChrome testID="screen-rx-refill-info">
      <View>
        <Text style={styles.title} testID="rx-refill-title">
          {RX_REFILL_TITLE}
        </Text>
        <Text style={styles.drug} testID="rx-refill-drug">
          {drug}
        </Text>
        {expires ? (
          <Text style={styles.meta} testID="rx-refill-expires">
            expires {expires}
          </Text>
        ) : null}
        <Text style={styles.ctaLine} testID="rx-refill-contact">
          {RX_REFILL_CTA}
        </Text>
        <Text style={styles.never} testID="rx-refill-never-sells">
          {RX_REFILL_NEVER}
        </Text>
      </View>
      <TierPrimary
        label="Back to Shelf"
        testID="rx-refill-back"
        onPress={() => router.replace(SHELF_HREF)}
      />
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  drug: { fontSize: 18, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 6 },
  meta: { fontSize: 14, color: AppTokens.color.muted, marginBottom: 16 },
  ctaLine: { fontSize: 16, color: AppTokens.color.ink, marginBottom: 12, lineHeight: 24 },
  never: {
    fontSize: 14,
    color: AppTokens.color.cardRedText,
    backgroundColor: AppTokens.color.cardRed,
    padding: 12,
    borderRadius: 10,
    lineHeight: 20,
  },
});
