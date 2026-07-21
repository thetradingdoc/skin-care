/**
 * Step 7 — Choose your plan (v4.1 frame 7).
 * Displays Free / Plus / Care from GET …/billing/subscription (tier) + pricing_policy.
 * Tool-first: Care is a tracking/habit tool, not medical treatment or a physical product.
 * Care does NOT include Plus AI (meter stays Free/Plus-as-purchased) — do not re-add "Everything in Plus".
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import {
  BILLING_CARE_CHECKOUT_HREF,
  PROGRESS_HREF,
  UNLOCK_AI_HREF,
} from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { mustUseExternalBrowserCheckout } from '@/lib/billing-platform-checkout';
import { patientGet } from '@/lib/patient-api';

export const CHOOSE_PLAN_TITLE = 'Choose your plan';
export const CHOOSE_PLAN_TAGLINE = 'Cancel anytime. Prices in USD.';

type PlanId = 'free' | 'plus' | 'care_program';

type SubPayload = {
  subscription?: { tier?: string; status?: string };
  pricing_policy?: {
    plus?: { monthly_price_cents?: number };
    care_program?: { monthly_price_cents?: number };
  };
};

function centsToDollars(cents: number | undefined, fallback: string): string {
  if (cents == null || !Number.isFinite(cents)) return fallback;
  const n = cents / 100;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export default function BillingChoosePlanScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<PlanId>('free');
  const [selected, setSelected] = useState<PlanId>('plus');
  const [plusLabel, setPlusLabel] = useState('$9.99');
  const [careLabel, setCareLabel] = useState('$29–49');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await patientGet('/api/patient/billing/subscription')) as SubPayload;
        if (cancelled) return;
        const tierRaw = String(data?.subscription?.tier || 'free').toLowerCase();
        const tier: PlanId =
          tierRaw === 'plus' ? 'plus' : tierRaw === 'care_program' ? 'care_program' : 'free';
        setCurrentTier(tier);
        setSelected(tier === 'free' ? 'plus' : tier);
        const plusCents = data?.pricing_policy?.plus?.monthly_price_cents;
        setPlusLabel(centsToDollars(plusCents, '$9.99'));
        // Mock frame 7 shows the Care range ($29–49), not a single list price.
        setCareLabel('$29–49');
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load plan status.');
          setCurrentTier('free');
          setSelected('plus');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueNext = () => {
    if (selected === 'free') {
      router.replace(PROGRESS_HREF);
      return;
    }
    if (selected === 'plus') {
      router.push(UNLOCK_AI_HREF);
      return;
    }
    router.push(BILLING_CARE_CHECKOUT_HREF);
  };

  const ctaLabel =
    selected === 'free'
      ? 'Continue with Free'
      : selected === 'plus'
        ? 'Continue with Plus'
        : 'Continue with Care Program';

  return (
    <SafeAreaView style={styles.root} testID="screen-billing-choose-plan" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" testID="choose-plan-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="choose-plan-title">
          {CHOOSE_PLAN_TITLE}
        </Text>
        <Text style={styles.tagline}>{CHOOSE_PLAN_TAGLINE}</Text>

        {loading ? <ActivityIndicator color={V4DesignTokens.color.red} /> : null}
        {error ? (
          <Text style={styles.error} testID="choose-plan-error">
            {error}
          </Text>
        ) : null}

        {!loading ? (
          <>
            <Text style={styles.current} testID="choose-plan-current-tier">
              Current plan: {currentTier === 'care_program' ? 'Care Program' : currentTier === 'plus' ? 'Plus' : 'Free'}
            </Text>

            <Pressable
              style={[styles.card, selected === 'free' && styles.cardOn]}
              testID="plan-free"
              onPress={() => setSelected('free')}>
              <View style={styles.row1}>
                <Text style={styles.planName}>Free</Text>
                <Text style={styles.price}>$0</Text>
              </View>
              <Text style={styles.bullet}>• Unlimited manual logging</Text>
              <Text style={styles.bullet}>• Calendar, Shelf, basic Progress</Text>
            </Pressable>

            <Pressable
              style={[styles.card, selected === 'plus' && styles.cardOn]}
              testID="plan-plus"
              onPress={() => setSelected('plus')}>
              {selected === 'plus' ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>MOST POPULAR</Text>
                </View>
              ) : null}
              <View style={styles.row1}>
                <Text style={styles.planName}>Plus</Text>
                <Text style={styles.price}>
                  {plusLabel}
                  <Text style={styles.priceUnit}>/mo</Text>
                </Text>
              </View>
              <Text style={styles.bullet}>• Unlimited AI-assisted capture reads</Text>
              <Text style={styles.bullet}>• Mark compare + reminders</Text>
            </Pressable>

            <Pressable
              style={[styles.card, selected === 'care_program' && styles.cardOn]}
              testID="plan-care"
              onPress={() => setSelected('care_program')}>
              <View style={styles.row1}>
                <Text style={styles.planName}>Care Program</Text>
                <Text style={styles.price}>
                  {careLabel}
                  <Text style={styles.priceUnit}>/mo</Text>
                </Text>
              </View>
              <Text style={styles.bullet}>• Guided plan tracking tool for your persona</Text>
              <Text style={styles.bullet}>• Habit checklist, weekly reminders, mark-compare timeline</Text>
              <Text style={styles.careNote} testID="plan-care-ai-note">
                Care is a guided tracking tool — it doesn't change your AI read limit. For more AI
                reads, choose Plus.
              </Text>
            </Pressable>

            <Text style={styles.toolNote} testID="choose-plan-tool-note">
              Plans unlock tracking tools and habit reminders — not medical treatment or products for
              purchase.
            </Text>
            {mustUseExternalBrowserCheckout(Platform.OS) ? (
              <Text style={styles.toolNote} testID="choose-plan-ios-external-note">
                On iPhone, Care and Plus checkout continue in your browser — there is no in-app payment
                form.
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {!loading ? (
        <View style={styles.footer}>
          <Pressable
            style={styles.cta}
            testID="choose-plan-cta"
            accessibilityRole="button"
            onPress={continueNext}>
            <Text style={styles.ctaLabel}>{ctaLabel}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 14, paddingBottom: 24 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 21,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 14,
  },
  current: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: V4DesignTokens.color.lineStrong,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: V4DesignTokens.color.white,
  },
  cardOn: {
    borderColor: V4DesignTokens.color.black,
    borderWidth: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: V4DesignTokens.color.red,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  badgeText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 10,
    color: V4DesignTokens.color.white,
    letterSpacing: 0.4,
  },
  row1: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  planName: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  price: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
  },
  priceUnit: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  bullet: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.black,
    lineHeight: 20,
    marginTop: 2,
  },
  careNote: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 17,
    color: V4DesignTokens.color.muted,
    marginTop: 10,
  },
  toolNote: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    lineHeight: 18,
    marginTop: 8,
  },
  error: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.red,
    marginBottom: 10,
  },
  footer: { paddingBottom: 12 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
});
