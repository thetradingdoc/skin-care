/**
 * Step 8 — Care Program checkout summary (v4.1 frame 8).
 * POST /api/patient/billing/care-program/checkout — fail closed when Price ID unset.
 * Claim-safe copy (verbatim): "This is not medical treatment and does not replace a dermatologist."
 *
 * Platform split: this screen is pricing/plan info only — never embeds Stripe Elements,
 * WebView, or AuthSession. CTA opens Stripe Checkout via Linking.openURL (external browser).
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
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
import { BILLING_CHOOSE_PLAN_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import {
  CARE_EXTERNAL_CTA_PREFIX,
  mustUseExternalBrowserCheckout,
  openBillingCheckoutUrl,
} from '@/lib/billing-platform-checkout';
import { getOnboardingConcernId } from '@/lib/onboarding-storage';
import { PatientApiError } from '@/lib/patient-api-error';
import { patientGet, patientPost } from '@/lib/patient-api';
import { getStoredEmail } from '@/lib/patient-session';
import { getPendingRoutineConcern } from '@/lib/routine-session';

export const CARE_CHECKOUT_TITLE = 'Care Program';

/** Claim-safety — must appear verbatim on this screen. */
export const CARE_CHECKOUT_CLAIM_SAFE =
  'This is not medical treatment and does not replace a dermatologist.';

export const CARE_CHECKOUT_WHAT =
  'A guided tracking tool: habit checklist, weekly reminders, mark-compare timeline for your plan. ' +
  CARE_CHECKOUT_CLAIM_SAFE;

const CONCERN_LABELS: Record<string, string> = {
  hyperpigmentation: 'Dark marks',
  acne: 'Active breakouts',
  rosacea: 'Sensitive / reactive',
  general_wellness: 'General wellness',
};

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatRenewDate(iso: string | null): string {
  if (!iso) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BillingCareCheckoutScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');
  const [concernId, setConcernId] = useState('hyperpigmentation');
  const [monthlyCents, setMonthlyCents] = useState(3900);
  const [renewIso, setRenewIso] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [concernPending, concernOnboarding, sub, me, storedEmail] = await Promise.all([
          getPendingRoutineConcern(),
          getOnboardingConcernId(),
          patientGet('/api/patient/billing/subscription').catch(() => null),
          patientGet('/api/patient/me').catch(() => null),
          getStoredEmail().catch(() => null),
        ]);
        if (cancelled) return;
        const concern = String(concernPending || concernOnboarding || 'hyperpigmentation');
        setConcernId(concern);
        const cents = Number(sub?.pricing_policy?.care_program?.monthly_price_cents);
        if (Number.isFinite(cents) && cents > 0) setMonthlyCents(cents);
        setRenewIso(sub?.subscription?.current_period_end || null);
        setEmail(
          String(me?.email || me?.patient?.email || storedEmail || '').trim(),
        );
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load checkout.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const concernLabel = CONCERN_LABELS[concernId] || concernId.replace(/_/g, ' ');
  const money = useMemo(() => formatMoney(monthlyCents), [monthlyCents]);
  const tagline = `${concernLabel} tracking tool — ${money}/mo`;
  const externalOnly = mustUseExternalBrowserCheckout(Platform.OS);
  const ctaLabel = busy
    ? 'Opening browser…'
    : externalOnly
      ? `${CARE_EXTERNAL_CTA_PREFIX} — ${money}/mo`
      : `Confirm — ${money}/mo`;

  const confirmCheckout = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!email) {
        throw new Error('Sign in is required before Care Program checkout.');
      }
      const data = await patientPost('/api/patient/billing/care-program/checkout', {
        email,
        concern_id: concernId,
        // Deep link still useful if Stripe redirects; primary verify path is app reopen + GET subscription.
        success_url: 'patientapp://subscription/success',
        cancel_url: 'patientapp://subscription/cancel',
      });
      const url = String(data?.checkout_url || '');
      // Platform split: external browser only — never AuthSession / WebView / Elements.
      await openBillingCheckoutUrl(url);
    } catch (e: unknown) {
      let msg = e instanceof Error ? e.message : 'Checkout failed';
      if (e instanceof PatientApiError) {
        const bodyErr = e.body?.error;
        if (typeof bodyErr === 'string' && bodyErr.trim()) msg = bodyErr;
        else if (bodyErr && typeof bodyErr === 'object' && typeof (bodyErr as { message?: string }).message === 'string') {
          msg = (bodyErr as { message: string }).message;
        }
      }
      // Fail closed — never fake success when Price ID unset.
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-billing-care-checkout" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="care-checkout-back"
        onBack={() => router.replace(BILLING_CHOOSE_PLAN_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="care-checkout-title">
          {CARE_CHECKOUT_TITLE}
        </Text>
        <Text style={styles.tagline} testID="care-checkout-tagline">
          {tagline}
        </Text>

        {loading ? <ActivityIndicator color={V4DesignTokens.color.red} /> : null}

        {!loading ? (
          <>
            <View style={styles.softCard}>
              <Text style={styles.softTitle}>What you're subscribing to</Text>
              <Text style={styles.softBody} testID="care-checkout-claim-safe">
                {CARE_CHECKOUT_WHAT}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldK}>Plan</Text>
              <Text style={styles.fieldV} testID="care-checkout-plan">
                Care Program — {concernLabel}
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldK}>Billing</Text>
              <Text style={styles.fieldV} testID="care-checkout-billing">
                {money} / month
              </Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldK}>Renews</Text>
              <Text style={styles.fieldV}>{formatRenewDate(renewIso)}</Text>
            </View>

            <Text style={styles.honesty}>
              Cancel anytime in Profile → Billing. No refund proration mid-cycle.
            </Text>

            {externalOnly ? (
              <Text style={styles.externalNote} testID="care-checkout-external-note">
                Checkout for Care Program opens outside the app, then brings you back when you're
                done.
              </Text>
            ) : null}

            {error ? (
              <Text style={styles.error} testID="care-checkout-error">
                {error}
              </Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {!loading ? (
        <View style={styles.footer}>
          <Pressable
            style={[styles.cta, busy && styles.ctaDisabled]}
            testID="care-checkout-confirm"
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void confirmCheckout()}>
            <Text style={styles.ctaLabel} testID="care-checkout-cta-label">
              {ctaLabel}
            </Text>
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
  softCard: {
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  softTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 13,
    color: V4DesignTokens.color.black,
    marginBottom: 6,
  },
  softBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    lineHeight: 20,
    color: V4DesignTokens.color.black,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  fieldK: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
  fieldV: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
    maxWidth: '62%',
    textAlign: 'right',
  },
  honesty: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: V4DesignTokens.color.muted,
    marginTop: 14,
  },
  externalNote: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    lineHeight: 18,
    color: V4DesignTokens.color.muted,
    marginTop: 12,
  },
  error: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.red,
    marginTop: 12,
    lineHeight: 18,
  },
  footer: { paddingBottom: 12 },
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
});
