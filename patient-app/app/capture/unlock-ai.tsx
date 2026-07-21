/**
 * Step 10 / P7.16 — T8 Unlock more AI reads (credits / Plus).
 * v4.1 frame 10 restyle.
 *
 * Platform split (iOS): pricing/plan info only — no in-app checkout chrome.
 * CTA opens Stripe via Linking.openURL (external browser). Never WebView /
 * AuthSession / Elements. G-IAP: purchase still external (not StoreKit yet).
 */
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { MANUAL_ENTRY_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import {
  PLUS_EXTERNAL_CTA,
  mustUseExternalBrowserCheckout,
  openBillingCheckoutUrl,
} from '@/lib/billing-platform-checkout';
import { patientGet, patientPost } from '@/lib/patient-api';
import { unlockCheckoutUrlFromResponse } from '@/lib/unlock-ai-checkout';

export const UNLOCK_TITLE = 'Unlock AI reads';
export const UNLOCK_SUB = "You've used your free reads this month.";
export const UNLOCK_HONESTY =
  'Manual logging stays free and unlimited either way — this only affects AI-assisted reads.';
export const UNLOCK_IOS_EXTERNAL_NOTE =
  'Unlocking more AI reads opens outside the app, then brings you back.';

export { unlockCheckoutUrlFromResponse } from '@/lib/unlock-ai-checkout';

type Pricing = {
  credit_pack?: { reads?: number; price_cents?: number };
  plus?: { monthly_price_cents?: number };
};

function money(cents: number | undefined, fallback: string): string {
  if (cents == null || !Number.isFinite(cents)) return fallback;
  return `$${(cents / 100).toFixed(2)}`.replace(/\.00$/, '');
}

export default function UnlockAiScreen() {
  const router = useRouter();
  const externalOnly = mustUseExternalBrowserCheckout(Platform.OS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<'plus' | 'pack'>('plus');
  const [pricing, setPricing] = useState<Pricing>({});
  const [usageLine, setUsageLine] = useState(UNLOCK_SUB);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const usage = await patientGet('/api/patient/ai/usage').catch(() => null);
        if (cancelled) return;
        const p = (usage?.pricing || {}) as Pricing;
        setPricing(p);
        const remaining = usage?.usage?.remaining;
        const limit = usage?.usage?.limit;
        if (limit != null) {
          setUsageLine(
            remaining === 0 || remaining === '0'
              ? `You've used your ${limit} free reads this month.`
              : `AI reads this month: ${remaining ?? '—'} of ${limit} left.`,
          );
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const plusPrice = money(pricing.plus?.monthly_price_cents, '$9.99');
  const packPrice = money(pricing.credit_pack?.price_cents, '$3.99');
  const packReads = pricing.credit_pack?.reads || 20;

  const startCheckout = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const path =
        selected === 'plus'
          ? '/api/patient/ai/plus/checkout'
          : '/api/patient/ai/credits/checkout';
      const res = await patientPost(path, {});
      const url = unlockCheckoutUrlFromResponse(res);
      if (!url) {
        setError('Checkout unavailable — Price ID may be unset.');
        return;
      }
      await openBillingCheckoutUrl(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  const primaryLabel = busy
    ? 'Opening browser…'
    : externalOnly
      ? selected === 'plus'
        ? `${PLUS_EXTERNAL_CTA} — Plus`
        : `${PLUS_EXTERNAL_CTA} — ${packReads} credits`
      : selected === 'plus'
        ? 'Continue with Plus'
        : `Buy ${packReads}-credit pack`;

  return (
    <SafeAreaView style={styles.root} testID="screen-t8-unlock-ai" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" testID="unlock-back" />
      <View style={styles.content}>
        <Text style={styles.title} testID="unlock-title">
          {UNLOCK_TITLE}
        </Text>
        <Text style={styles.sub} testID="unlock-sub">
          {usageLine}
        </Text>

        <Pressable
          style={[styles.card, selected === 'plus' && styles.cardOn]}
          testID="unlock-plus"
          onPress={() => setSelected('plus')}>
          <View style={styles.row1}>
            <Text style={styles.cardTitle}>Plus — unlimited</Text>
            <Text style={styles.price}>
              {plusPrice}
              <Text style={styles.priceUnit}>/mo</Text>
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.card, selected === 'pack' && styles.cardOn]}
          testID="unlock-pack-20"
          onPress={() => setSelected('pack')}>
          <View style={styles.row1}>
            <Text style={styles.cardTitle}>{packReads}-credit pack</Text>
            <Text style={styles.price}>{packPrice}</Text>
          </View>
        </Pressable>

        <Text style={styles.honesty} testID="unlock-honesty">
          {UNLOCK_HONESTY}
        </Text>

        {externalOnly ? (
          <Text style={styles.externalNote} testID="unlock-external-note">
            {UNLOCK_IOS_EXTERNAL_NOTE}
          </Text>
        ) : null}

        {error ? (
          <Text style={styles.error} testID="unlock-checkout-error">
            {error}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        style={[styles.cta, busy ? styles.ctaDisabled : null]}
        disabled={busy}
        testID="unlock-choose"
        onPress={() => void startCheckout()}>
        <Text style={styles.ctaLabel} testID="unlock-cta-label">
          {primaryLabel}
        </Text>
      </Pressable>

      {externalOnly ? (
        <Pressable
          style={styles.manual}
          testID="unlock-ios-manual"
          accessibilityRole="button"
          onPress={() => router.push(MANUAL_ENTRY_HREF)}>
          <Text style={styles.manualLabel}>Log manually instead</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: V4DesignTokens.color.white,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  content: { flex: 1, paddingTop: 14 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardOn: {
    borderColor: V4DesignTokens.color.black,
    borderWidth: 2,
  },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  price: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
  },
  priceUnit: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: V4DesignTokens.color.muted,
    marginTop: 8,
  },
  externalNote: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: V4DesignTokens.color.muted,
    marginTop: 10,
  },
  error: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.red,
    marginTop: 12,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  manual: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  manualLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
});
