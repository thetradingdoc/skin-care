/**
 * P7.16 — T8 Unlock more AI reads (credits / Plus).
 * Checkout must open via Linking(url) or fail visibly — never silent navigate-away.
 *
 * iOS App Store builds: purchase UI paused until StoreKit (isUnlockAiPurchaseEnabled).
 * Stripe checkout code path kept for web / future StoreKit — not deleted.
 */
import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { SecondTierChrome, TierPrimary } from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { MANUAL_ENTRY_HREF } from '@/constants/routes';
import { patientPost } from '@/lib/patient-api';
import { unlockCheckoutUrlFromResponse } from '@/lib/unlock-ai-checkout';
import {
  UNLOCK_AI_IOS_PAUSED_BODY,
  UNLOCK_AI_IOS_PAUSED_TITLE,
  isUnlockAiPurchaseEnabled,
} from '@/lib/unlock-ai-commerce';

export const UNLOCK_TITLE = 'More AI reads';
export const UNLOCK_SUB =
  'manual logging is always free — this only covers AI-read photos/documents';

export { unlockCheckoutUrlFromResponse } from '@/lib/unlock-ai-checkout';

export default function UnlockAiScreen() {
  const router = useRouter();
  const purchaseEnabled = isUnlockAiPurchaseEnabled();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choosePack = async () => {
    if (!purchaseEnabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await patientPost('/api/patient/ai/credits/checkout', {});
      const url = unlockCheckoutUrlFromResponse(res);
      if (!url) {
        setError('Checkout unavailable — try again.');
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setError('Checkout link could not be opened.');
        return;
      }
      await Linking.openURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!purchaseEnabled) {
    return (
      <SecondTierChrome testID="screen-t8-unlock-ai">
        <View>
          <Text style={styles.title} testID="unlock-title">
            {UNLOCK_AI_IOS_PAUSED_TITLE}
          </Text>
          <Text style={styles.sub} testID="unlock-ios-paused-body">
            {UNLOCK_AI_IOS_PAUSED_BODY}
          </Text>
        </View>
        <TierPrimary
          label="Log manually instead"
          testID="unlock-ios-manual"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}
        />
      </SecondTierChrome>
    );
  }

  return (
    <SecondTierChrome testID="screen-t8-unlock-ai">
      <View>
        <Text style={styles.title} testID="unlock-title">
          {UNLOCK_TITLE}
        </Text>
        <Text style={styles.sub}>{UNLOCK_SUB}</Text>
        <View style={styles.card} testID="unlock-pack-20">
          <Text style={styles.cardTitle}>20 reads</Text>
          <Text style={styles.price}>$3.99</Text>
        </View>
        <View style={styles.card} testID="unlock-plus">
          <Text style={styles.cardTitle}>Unlimited monthly</Text>
          <Text style={styles.price}>$9.99/mo</Text>
        </View>
        {error ? (
          <Text style={styles.error} testID="unlock-checkout-error">
            {error}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        style={[styles.primary, busy ? styles.primaryDisabled : null]}
        disabled={busy}
        testID="unlock-choose"
        onPress={() => void choosePack()}>
        <Text style={styles.primaryLabel}>{busy ? 'Opening…' : 'Choose'}</Text>
      </Pressable>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 16, lineHeight: 22 },
  card: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: '600', color: AppTokens.color.ink },
  price: { marginTop: 4, color: AppTokens.color.muted },
  error: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 20,
    color: AppTokens.color.cardRedText,
  },
  primary: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.6 },
  primaryLabel: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
