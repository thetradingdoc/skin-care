/**
 * Step 9 — Subscribed confirmation (v4.1 frame 9).
 *
 * Primary path after external-browser checkout: user returns to the app
 * (reopen / AppState active). Success only after GET …/billing/subscription
 * shows an active paid tier (webhook truth) — never optimistic on redirect alone.
 * Deep link patientapp://subscription/success still lands here as a convenience.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  BILLING_CHOOSE_PLAN_HREF,
  BILLING_MANAGE_HREF,
  PROGRESS_HREF,
} from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { getOnboardingConcernId } from '@/lib/onboarding-storage';
import { patientGet } from '@/lib/patient-api';
import { getPendingRoutineConcern } from '@/lib/routine-session';

const CONCERN_LABELS: Record<string, string> = {
  hyperpigmentation: 'Dark Marks',
  acne: 'Active Breakouts',
  rosacea: 'Sensitive Skin',
  general_wellness: 'General Wellness',
};

type Phase = 'polling' | 'active' | 'pending' | 'error';

export default function BillingSubscribedScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('polling');
  const [planLabel, setPlanLabel] = useState('your plan');
  const [detail, setDetail] = useState<string | null>(null);
  const pollGeneration = useRef(0);

  const poll = useCallback(async () => {
    const gen = ++pollGeneration.current;
    setPhase('polling');
    setDetail(null);
    const concern =
      (await getPendingRoutineConcern()) || (await getOnboardingConcernId()) || 'hyperpigmentation';
    const label = CONCERN_LABELS[concern] || concern.replace(/_/g, ' ');
    if (gen !== pollGeneration.current) return;
    setPlanLabel(label);

    const started = Date.now();
    const maxMs = 12_000;
    while (Date.now() - started < maxMs) {
      if (gen !== pollGeneration.current) return;
      try {
        const data = await patientGet('/api/patient/billing/subscription');
        if (gen !== pollGeneration.current) return;
        const tier = String(data?.subscription?.tier || 'free').toLowerCase();
        const status = String(data?.subscription?.status || '').toLowerCase();
        if ((tier === 'care_program' || tier === 'plus') && status === 'active') {
          setPhase('active');
          return;
        }
      } catch (e: unknown) {
        if (gen !== pollGeneration.current) return;
        setPhase('error');
        setDetail(e instanceof Error ? e.message : 'Could not verify subscription.');
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (gen !== pollGeneration.current) return;
    // External payment may still be settling — do not fake success.
    setPhase('pending');
    setDetail(
      'Not active yet after reopen. Stripe webhook may still be processing, or Care/Plus Price IDs are unset so checkout never completed. Tap Check again after paying in the browser.',
    );
  }, []);

  // App reopen / focus after external browser payment — this is the primary verify path.
  useFocusEffect(
    useCallback(() => {
      void poll();
    }, [poll]),
  );

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void poll();
    });
    return () => sub.remove();
  }, [poll]);

  return (
    <SafeAreaView style={styles.root} testID="screen-billing-subscribed" edges={['top', 'bottom']}>
      <View style={styles.center}>
        {phase === 'polling' ? (
          <>
            <ActivityIndicator color={V4DesignTokens.color.red} size="large" />
            <Text style={styles.waiting} testID="subscribed-polling">
              Confirming your subscription…
            </Text>
            <Text style={styles.tagline} testID="subscribed-reopen-note">
              Checking billing status after you return to the app — not trusting an in-app checkout
              redirect alone.
            </Text>
          </>
        ) : null}

        {phase === 'active' ? (
          <>
            <View style={styles.ring} testID="subscribed-success-ring">
              <Text style={styles.check}>✓</Text>
            </View>
            <Text style={styles.title} testID="subscribed-title">
              You're on the {planLabel} plan
            </Text>
            <Text style={styles.tagline}>
              Your habit checklist and reminders are ready in Progress.
            </Text>
          </>
        ) : null}

        {phase === 'pending' || phase === 'error' ? (
          <>
            <Text style={styles.titlePending} testID="subscribed-pending-title">
              Subscription not confirmed yet
            </Text>
            <Text style={styles.tagline} testID="subscribed-pending-detail">
              {detail}
            </Text>
          </>
        ) : null}
      </View>

      <View style={styles.footer}>
        {phase === 'active' ? (
          <Pressable
            style={styles.cta}
            testID="subscribed-go-progress"
            onPress={() => router.replace(PROGRESS_HREF)}>
            <Text style={styles.ctaLabel}>Go to Progress</Text>
          </Pressable>
        ) : null}
        {phase === 'pending' || phase === 'error' ? (
          <>
            <Pressable
              style={styles.cta}
              testID="subscribed-retry"
              onPress={() => void poll()}>
              <Text style={styles.ctaLabel}>Check again</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              testID="subscribed-manage"
              onPress={() => router.replace(BILLING_MANAGE_HREF)}>
              <Text style={styles.secondaryLabel}>Billing</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              testID="subscribed-plans"
              onPress={() => router.replace(BILLING_CHOOSE_PLAN_HREF)}>
              <Text style={styles.secondaryLabel}>Choose a plan</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: V4DesignTokens.color.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  check: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 28,
    color: V4DesignTokens.color.red,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
  },
  titlePending: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.black,
    textAlign: 'center',
    marginBottom: 8,
  },
  waiting: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
    marginTop: 16,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
    lineHeight: 20,
  },
  footer: { paddingBottom: 22, gap: 10 },
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
  secondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
});
