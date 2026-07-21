/**
 * P7.16 — T6 AI cap reached (manual still free).
 * Unlock AI purchase CTA is gated — hidden on iOS until StoreKit (see unlock-ai-commerce).
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
import {
  AI_CAP_BODY_MANUAL_ONLY,
  AI_CAP_BODY_WITH_UNLOCK,
  isUnlockAiPurchaseEnabled,
} from '@/lib/unlock-ai-commerce';

export const AI_CAP_TITLE = 'Free AI reads used';
/** @deprecated Prefer AI_CAP_BODY_MANUAL_ONLY / WITH_UNLOCK — kept for import stability */
export const AI_CAP_BODY = AI_CAP_BODY_WITH_UNLOCK;

export default function AiCapScreen() {
  const router = useRouter();
  const purchaseEnabled = isUnlockAiPurchaseEnabled();
  const body = purchaseEnabled ? AI_CAP_BODY_WITH_UNLOCK : AI_CAP_BODY_MANUAL_ONLY;

  return (
    <SecondTierChrome testID="screen-t6-ai-cap">
      <View>
        <Text style={styles.title} testID="ai-cap-title">
          {AI_CAP_TITLE}
        </Text>
        <Text style={styles.body} testID="ai-cap-body">
          {body}
        </Text>
      </View>
      <View>
        <TierPrimary
          label="Log manually instead"
          testID="ai-cap-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
        />
        {purchaseEnabled ? (
          <TierSecondary
            label="See options"
            testID="ai-cap-options"
            onPress={() => router.push(UNLOCK_AI_HREF)}
          />
        ) : null}
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 24, color: AppTokens.color.muted },
});
