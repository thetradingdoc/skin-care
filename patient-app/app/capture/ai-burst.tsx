/**
 * P8.01 — Burst guard UX (10/24h). Enforcement is already in ai-capture-meter;
 * this screen is the production message when clients receive AI_BURST_LIMIT.
 * Unlock purchase CTA gated on iOS (see unlock-ai-commerce).
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { MANUAL_ENTRY_HREF, UNLOCK_AI_HREF } from '@/constants/routes';
import { isUnlockAiPurchaseEnabled } from '@/lib/unlock-ai-commerce';

export const AI_BURST_TITLE = 'Too many AI reads in a short time';
export const AI_BURST_BODY =
  'for safety we cap AI reads at 10 in 24 hours. you can still log this manually right now — free, no limit — or try AI again later.';
export const AI_BURST_ERROR_CODE = 'AI_BURST_LIMIT';

export default function AiBurstScreen() {
  const router = useRouter();
  const purchaseEnabled = isUnlockAiPurchaseEnabled();

  return (
    <SecondTierChrome testID="screen-t6b-ai-burst">
      <View>
        <Text style={styles.title} testID="ai-burst-title">
          {AI_BURST_TITLE}
        </Text>
        <Text style={styles.body} testID="ai-burst-body">
          {AI_BURST_BODY}
        </Text>
        <Text style={styles.code} testID="ai-burst-error-code">
          {AI_BURST_ERROR_CODE}
        </Text>
      </View>
      <View>
        <TierPrimary
          label="Log manually instead"
          testID="ai-burst-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
        />
        {purchaseEnabled ? (
          <TierSecondary
            label="See unlock options"
            testID="ai-burst-unlock"
            onPress={() => router.push(UNLOCK_AI_HREF)}
          />
        ) : null}
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted, marginBottom: 12 },
  code: { fontSize: 12, color: AppTokens.color.hint },
});
