/**
 * Step 11 — Billing management (v4.1 frame 11).
 * GET /api/patient/billing/subscription for plan/renewal/payment-method.
 * Cancel calls POST /api/patient/billing/subscription/cancel (real endpoint — fail closed if no Stripe sub).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { BILLING_CHOOSE_PLAN_HREF, PROFILE_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { patientGet, patientPost } from '@/lib/patient-api';

type SubPayload = {
  subscription?: {
    tier?: string;
    status?: string;
    current_period_end?: string | null;
    concern_id?: string | null;
    cancel_at_period_end?: boolean;
    payment_method?: { brand?: string; last4?: string } | null;
    has_stripe_subscription?: boolean;
  };
  pricing_policy?: {
    plus?: { monthly_price_cents?: number };
    care_program?: { monthly_price_cents?: number };
  };
};

const CONCERN_LABELS: Record<string, string> = {
  hyperpigmentation: 'Dark marks',
  acne: 'Active breakouts',
  rosacea: 'Sensitive / reactive',
  general_wellness: 'General wellness',
};

function tierTitle(tier: string, concernId: string | null | undefined): string {
  if (tier === 'care_program') {
    const c = concernId ? CONCERN_LABELS[concernId] || concernId : null;
    return c ? `Care Program — ${c}` : 'Care Program';
  }
  if (tier === 'plus') return 'Plus';
  return 'Free';
}

function moneyFromCents(cents: number | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return `$${(cents / 100).toFixed(2)}/mo`;
}

function formatRenew(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function BillingManageScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await patientGet('/api/patient/billing/subscription')) as SubPayload;
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load billing.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tier = String(data?.subscription?.tier || 'free').toLowerCase();
  const concernId = data?.subscription?.concern_id;
  const title = tierTitle(tier, concernId);
  const price =
    tier === 'care_program'
      ? moneyFromCents(data?.pricing_policy?.care_program?.monthly_price_cents)
      : tier === 'plus'
        ? moneyFromCents(data?.pricing_policy?.plus?.monthly_price_cents)
        : '$0';
  const renew = formatRenew(data?.subscription?.current_period_end);
  const pm = data?.subscription?.payment_method;
  const pmLabel = pm?.last4
    ? `${String(pm.brand || 'Card')} •••• ${pm.last4}`
    : 'Not on file yet';
  const subLine = [price, renew ? `renews ${renew}` : null, data?.subscription?.cancel_at_period_end ? 'cancels at period end' : null]
    .filter(Boolean)
    .join(' · ');

  const runCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await patientPost('/api/patient/billing/subscription/cancel', {});
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () => {
    const message =
      'This requests cancel-at-period-end via Stripe. If no Stripe subscription is on file (or Price IDs are unset), the API will fail closed with a clear error.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Cancel plan?\n\n${message}`)) void runCancel();
      return;
    }
    Alert.alert('Cancel plan?', message, [
      { text: 'Keep plan', style: 'cancel' },
      { text: 'Cancel plan', style: 'destructive', onPress: () => void runCancel() },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-billing-manage" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="billing-manage-back"
        onBack={() => router.replace(PROFILE_HREF)}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="billing-manage-title">
          Billing
        </Text>

        {loading ? <ActivityIndicator color={V4DesignTokens.color.red} /> : null}
        {error ? (
          <Text style={styles.error} testID="billing-manage-error">
            {error}
          </Text>
        ) : null}

        {!loading && data ? (
          <>
            <View style={styles.planCard} testID="billing-plan-card">
              <View style={styles.ic}>
                <Text style={styles.icText}>✦</Text>
              </View>
              <View style={styles.planMeta}>
                <Text style={styles.planTitle}>{title}</Text>
                <Text style={styles.planSub}>{subLine || 'No renewal date on file'}</Text>
              </View>
            </View>

            <View style={styles.row} testID="billing-payment-method">
              <View style={styles.rowIcon} />
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Payment method</Text>
                <Text style={styles.rowSub}>{pmLabel}</Text>
              </View>
            </View>

            <View style={[styles.row, styles.rowLast]} testID="billing-history">
              <View style={styles.rowIcon} />
              <View style={styles.rowMeta}>
                <Text style={styles.rowTitle}>Billing history</Text>
                <Text style={styles.rowSub}>
                  {data?.subscription?.has_stripe_subscription
                    ? 'Available after Stripe invoices sync'
                    : 'No invoices yet'}
                </Text>
              </View>
            </View>

            {tier !== 'free' ? (
              <Pressable
                testID="billing-cancel-plan"
                accessibilityRole="button"
                disabled={busy}
                onPress={confirmCancel}
                style={styles.cancel}>
                <Text style={styles.cancelText}>{busy ? 'Canceling…' : 'Cancel plan'}</Text>
              </Pressable>
            ) : (
              <Pressable
                testID="billing-choose-plan"
                onPress={() => router.push(BILLING_CHOOSE_PLAN_HREF)}
                style={styles.cancel}>
                <Text style={styles.upgradeText}>Choose a plan</Text>
              </Pressable>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { paddingTop: 14, paddingBottom: 32 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 20,
    color: V4DesignTokens.color.black,
    marginBottom: 16,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  ic: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: V4DesignTokens.color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icText: { color: V4DesignTokens.color.red, fontSize: 18 },
  planMeta: { flex: 1 },
  planTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  planSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#F6F6F6',
  },
  rowMeta: { flex: 1 },
  rowTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  rowSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  cancel: { marginTop: 18, paddingVertical: 8 },
  cancelText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.red,
  },
  upgradeText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.black,
  },
  error: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.red,
    marginBottom: 12,
    lineHeight: 18,
  },
});
