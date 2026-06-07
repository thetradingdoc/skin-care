import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { useToast } from '@/components/billing-feedback';
import { PrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { JournalTokens } from '@/constants/journalTokens';
import { patientGet, patientPost } from '@/lib/patient-api';
import { clearPatientSession, EMAIL_KEY } from '@/lib/patient-session';

type PlanTier = 'free' | 'care_program' | 'plus';

type CareProgramPricing = {
  monthly_price_cents?: number;
  currency?: string;
  description?: string;
};

export default function AccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subscription?: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [carePricing, setCarePricing] = useState<CareProgramPricing | null>(null);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storedEmail = await SecureStore.getItemAsync(EMAIL_KEY);
      if (!storedEmail) {
        setSignedIn(false);
        setEmail(null);
        setProgramName(null);
        setPlanTier('free');
        return;
      }
      setSignedIn(true);
      setEmail(storedEmail);

      const [template, sub, features] = await Promise.all([
        patientGet('/api/patient/routine/template').catch(() => null),
        patientGet('/api/patient/billing/subscription').catch(() => null),
        patientGet('/api/patient/features').catch(() => null),
      ]);

      if (template?.has_template && template?.template?.name) {
        setProgramName(String(template.template.name));
      } else {
        setProgramName(null);
      }

      const tierRaw = String(sub?.subscription?.tier || 'free').toLowerCase();
      setPlanTier(tierRaw === 'care_program' ? 'care_program' : tierRaw === 'plus' ? 'plus' : 'free');
      setCarePricing(sub?.pricing_policy?.care_program || null);
      setWalletEnabled(Boolean(features?.features?.wallet_enabled));
    } catch {
      setSignedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const status = typeof params.subscription === 'string' ? params.subscription : '';
    if (status === 'success') {
      showToast('Subscription active — thank you!', 'success');
      void load();
    } else if (status === 'cancel') {
      showToast('Checkout canceled', 'error');
    }
  }, [params.subscription, load, showToast]);

  const signOut = useCallback(async () => {
    await clearPatientSession();
    setSignedIn(false);
    setEmail(null);
    setProgramName(null);
    router.replace('/sign-in');
  }, [router]);

  async function startCareProgramCheckout() {
    if (!email) return;
    setCheckoutBusy(true);
    try {
      const data = await patientPost('/api/patient/billing/care-program/checkout', {
        email,
        success_url: 'patientapp://subscription/success',
        cancel_url: 'patientapp://subscription/cancel',
      });
      const url = String(data?.checkout_url || '');
      if (!url) throw new Error('Checkout URL missing');
      await WebBrowser.openAuthSessionAsync(url, 'patientapp://subscription/success');
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not start checkout', 'error');
    } finally {
      setCheckoutBusy(false);
    }
  }

  const monthlyLabel = carePricing?.monthly_price_cents
    ? `$${(carePricing.monthly_price_cents / 100).toFixed(2)}/mo`
    : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account</Text>

        {loading ? (
          <ActivityIndicator color={JournalTokens.color.accent} />
        ) : !signedIn ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardBody}>
              Sign in to sync your routine, progress photos, and program subscription.
            </Text>
            <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              {email ? <Text style={styles.email}>{email}</Text> : null}
              {programName ? (
                <Text style={styles.program}>Program: {programName}</Text>
              ) : (
                <Text style={styles.programMuted}>No active routine program</Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Program subscription</Text>
                <View
                  style={[
                    styles.badge,
                    planTier === 'care_program' ? styles.badgeActive : styles.badgeNeutral,
                  ]}>
                  <Text
                    style={[
                      styles.badgeText,
                      planTier === 'care_program' ? styles.badgeTextActive : styles.badgeTextNeutral,
                    ]}>
                    {planTier === 'care_program' ? 'Active' : 'Free'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardBody}>
                {planTier === 'care_program'
                  ? 'Your guided skin program subscription is active.'
                  : 'Subscribe to unlock the full 12-week guided tracking program.'}
              </Text>
              {monthlyLabel ? (
                <Text style={styles.pricingMeta}>
                  {carePricing?.description || 'Care program'} — {monthlyLabel}
                </Text>
              ) : null}
              {planTier !== 'care_program' ? (
                <PrimaryButton
                  label={checkoutBusy ? 'Opening checkout…' : 'Subscribe'}
                  onPress={() => void startCareProgramCheckout()}
                />
              ) : null}
            </View>

            {walletEnabled ? (
              <Pressable
                style={styles.linkRow}
                onPress={() => router.push('/(tabs)/money')}
                accessibilityRole="button">
                <Text style={styles.linkLabel}>Bills & receipts</Text>
                <Text style={styles.linkChevron}>›</Text>
              </Pressable>
            ) : null}

            <SecondaryButton label="Change program" onPress={() => router.push('/routine/pick')} />
            <View style={{ height: 12 }} />
            <SecondaryButton label="Sign out" onPress={() => void signOut()} />

            <Text style={styles.disclaimer}>
              Not a diagnosis. See a dermatologist if your symptoms worsen or you are unsure.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  content: { padding: JournalTokens.spacing.lg, gap: 14 },
  title: { fontFamily: JournalTokens.font.display, fontSize: 28, color: JournalTokens.color.ink },
  card: {
    backgroundColor: JournalTokens.color.card,
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: JournalTokens.spacing.md,
    gap: 8,
  },
  cardTitle: { fontWeight: '700', fontSize: 17, color: JournalTokens.color.ink },
  cardBody: { color: JournalTokens.color.muted, lineHeight: 20 },
  email: { fontSize: 15, color: JournalTokens.color.ink, fontWeight: '600' },
  program: { fontSize: 14, color: JournalTokens.color.muted, marginTop: 4 },
  programMuted: { fontSize: 14, color: JournalTokens.color.muted, fontStyle: 'italic' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeNeutral: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: '#166534' },
  badgeTextNeutral: { color: '#64748b' },
  pricingMeta: { fontSize: 13, color: JournalTokens.color.muted },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: JournalTokens.color.card,
    borderRadius: JournalTokens.radius.md,
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    padding: JournalTokens.spacing.md,
    minHeight: JournalTokens.minTap,
  },
  linkLabel: { fontSize: 16, fontWeight: '600', color: JournalTokens.color.ink },
  linkChevron: { fontSize: 22, color: JournalTokens.color.muted },
  disclaimer: {
    color: JournalTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
