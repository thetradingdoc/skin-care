// BLOCK 2 branding & UI — 2026-07-12
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/billing-feedback';
import { ConsumerPrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { GoalsCard, JourneyModeCard } from '@/components/v3';
import { dismissGoal, fetchGoals, type PatientGoal } from '@/lib/goals-api';
import { AppTokens } from '@/constants/appTokens';
import { fetchBioProfile, saveBioProfile } from '@/lib/conflict-api';
import type { BioProfile } from '@/lib/conflict-types';
import {
  getJourneyProfile,
  toggleJourneyMode,
  type JourneyMode,
} from '@/lib/journey-mode-storage';
import { patientGet, patientPost } from '@/lib/patient-api';
import { trackPortalEvent } from '@/lib/trackPortalEvent';
import { clearPatientSession, getStoredEmail } from '@/lib/patient-session';
import { JOURNEY_CHOOSE_HREF, ORDERS_HREF, SHOP_HREF, SIGN_IN_HREF, BIO_CALIBRATION_HREF, TRY_ALLERGENS_HREF } from '@/constants/routes';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { TOUCHE_HOME_URL, TOUCHE_SKIN_COLLECTION_URL } from '@/constants/storeConfig';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import {
  getAdvancedSeverityEnabled,
  setAdvancedSeverityEnabled,
} from '@/lib/advanced-severity-pref';
import {
  getDailyReminderEnabled,
  setDailyReminderEnabled,
  syncDailyReminderSchedule,
} from '@/lib/push-reminders';

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
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showCareProgram, setShowCareProgram] = useState(false);
  const [bioProfile, setBioProfile] = useState<BioProfile | null>(null);
  const [journeyModes, setJourneyModes] = useState<JourneyMode[]>([]);
  const [goals, setGoals] = useState<PatientGoal[]>([]);
  const [advancedSeverity, setAdvancedSeverity] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [procedureDate, setProcedureDate] = useState('');
  const [procedureType, setProcedureType] = useState('');
  const [allergensList, setAllergensList] = useState<Array<{ allergen_class: string; label?: string }>>([]);
  const [budgetBand, setBudgetBand] = useState('');
  const [climateZone, setClimateZone] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);
  const [isAppMember, setIsAppMember] = useState(false);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storedEmail = await getStoredEmail();
      if (!storedEmail) {
        setSignedIn(false);
        setEmail(null);
        setProgramName(null);
        setPlanTier('free');
        return;
      }
      setSignedIn(true);
      setEmail(storedEmail);

      const [template, sub, features, bio] = await Promise.all([
        patientGet('/api/patient/routine/template').catch(() => null),
        patientGet('/api/patient/billing/subscription').catch(() => null),
        patientGet('/api/patient/features').catch(() => null),
        fetchBioProfile().catch(() => null),
      ]);
      setBioProfile(bio);
      if (bio?.procedure_date) setProcedureDate(String(bio.procedure_date));
      if (bio?.procedure_type) setProcedureType(String(bio.procedure_type));
      if (bio?.budget_band) setBudgetBand(String(bio.budget_band));
      if (bio?.climate_zone) setClimateZone(String(bio.climate_zone));
      if (bio?.zip) setZipInput(String(bio.zip));
      try {
        const al = await patientGet('/api/patient/allergens');
        setAllergensList(Array.isArray(al?.allergens) ? al.allergens : []);
      } catch {
        setAllergensList([]);
      }
      try {
        const [status, orders] = await Promise.all([
          patientGet('/api/patient/commerce/status').catch(() => null),
          patientGet('/api/patient/orders').catch(() => null),
        ]);
        if (status?.commerce_ctas_enabled) setCommerceOn(true);
        const list = Array.isArray(orders?.orders) ? orders.orders : [];
        setIsAppMember(list.some((o: { app_member?: number }) => Number(o.app_member) === 1));
      } catch {
        /* optional */
      }

      const [adv, rem] = await Promise.all([
        getAdvancedSeverityEnabled(),
        getDailyReminderEnabled(),
      ]);
      setAdvancedSeverity(adv);
      setDailyReminder(rem);

      if (template?.has_template && template?.template?.name) {
        setProgramName(String(template.template.name));
      } else {
        setProgramName(null);
      }

      const tierRaw = String(sub?.subscription?.tier || 'free').toLowerCase();
      setPlanTier(tierRaw === 'care_program' ? 'care_program' : tierRaw === 'plus' ? 'plus' : 'free');
      setCarePricing(sub?.pricing_policy?.care_program || null);
      setWalletEnabled(Boolean(features?.features?.wallet_enabled));
      const journey = await getJourneyProfile();
      setJourneyModes(journey?.modes ?? []);
      try {
        setGoals(await fetchGoals('active'));
      } catch {
        setGoals([]);
      }
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
    if (!loading && signedIn) trackPortalEvent('account_viewed');
  }, [loading, signedIn]);

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
    router.replace(SIGN_IN_HREF);
  }, [router]);

  /** TOUCH-098 — initiates DELETE/post account purge (TOUCH-099 backend). */
  const runDeleteAccount = useCallback(async () => {
    setDeleteBusy(true);
    try {
      await patientPost('/api/patient/account/delete', { confirm: true });
      await clearPatientSession();
      setSignedIn(false);
      setEmail(null);
      showToast('Account deleted', 'success');
      router.replace(SIGN_IN_HREF);
    } catch (e: unknown) {
      showToast(
        e instanceof Error ? e.message : 'Could not delete account — try again or contact support',
        'error',
      );
    } finally {
      setDeleteBusy(false);
    }
  }, [router, showToast]);

  const confirmDeleteAccount = useCallback(() => {
    const message =
      'This permanently deletes your account, progress photos, and health-related profile data (allergens, conditions, prescriptions). This cannot be undone.';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`Delete account?\n\n${message}`)) {
        void runDeleteAccount();
      }
      return;
    }
    Alert.alert('Delete account?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: () => void runDeleteAccount(),
      },
    ]);
  }, [runDeleteAccount]);

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
        <Text style={styles.title}>Profile</Text>

        {loading ? (
          <ActivityIndicator color={AppTokens.color.accent} />
        ) : !signedIn ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardBody}>
              Sign in to sync your routine, progress photos, and program subscription.
            </Text>
            <ConsumerPrimaryButton label="Sign in" onPress={() => router.push(SIGN_IN_HREF)} />
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
              <Text style={styles.cardTitle}>Your journeys</Text>
              <Text style={styles.cardBody}>Turn on the experiences you use. You can enable both.</Text>
              <JourneyModeCard
                variant="watch"
                title="Keep a skin diary"
                subtitle="Daily photos and notes to find your triggers"
                selected={journeyModes.includes('watch')}
                onPress={() =>
                  void toggleJourneyMode('watch', !journeyModes.includes('watch')).then((p) =>
                    setJourneyModes(p.modes),
                  )
                }
              />
              <JourneyModeCard
                variant="routine"
                title="Improve my skin routine"
                subtitle="Product conflicts and 12-week program"
                selected={journeyModes.includes('routine')}
                onPress={() =>
                  void toggleJourneyMode('routine', !journeyModes.includes('routine')).then((p) =>
                    setJourneyModes(p.modes),
                  )
                }
              />
              <JourneyModeCard
                variant="spot"
                title="Watch a spot or mark"
                subtitle="Track a mole, growth, or area over time"
                selected={journeyModes.includes('spot')}
                onPress={() =>
                  void toggleJourneyMode('spot', !journeyModes.includes('spot')).then((p) =>
                    setJourneyModes(p.modes),
                  )
                }
              />
              <SecondaryButton
                label="Change journey setup"
                onPress={() => router.push(JOURNEY_CHOOSE_HREF)}
              />
            </View>

            <View style={styles.card}>
              <GoalsCard
                goals={goals}
                onDismiss={(id) => {
                  void dismissGoal(id)
                    .then(() => fetchGoals('active'))
                    .then(setGoals)
                    .catch((e: unknown) =>
                      showToast(e instanceof Error ? e.message : 'Could not update goal', 'error'),
                    );
                }}
              />
              {!goals.length ? (
                <Text style={styles.cardBody}>Goals from onboarding will appear here.</Text>
              ) : null}
            </View>

            {/* TOUCH-086 — allergens before advanced-fields toggle / More card */}
            <View style={styles.card} testID="profile-allergens">
              <Text style={styles.cardTitle}>Allergens</Text>
              <Text style={styles.cardBody}>
                {allergensList.length
                  ? allergensList.map((a) => a.label || a.allergen_class).join(', ')
                  : 'Nothing ruled out yet.'}
              </Text>
              <ConsumerPrimaryButton
                label="Edit allergens"
                onPress={() => router.push(TRY_ALLERGENS_HREF)}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>More</Text>
              <Pressable
                style={styles.rowToggle}
                onPress={() => {
                  const next = !advancedSeverity;
                  setAdvancedSeverity(next);
                  void setAdvancedSeverityEnabled(next);
                }}
                testID="advanced-severity-toggle"
                accessibilityRole="switch"
                accessibilityState={{ checked: advancedSeverity }}>
                <Text style={styles.cardBody}>Advanced 1–10 severity sliders</Text>
                <Text style={styles.email}>{advancedSeverity ? 'On' : 'Off'}</Text>
              </Pressable>
              <Pressable
                style={styles.rowToggle}
                onPress={() => {
                  const next = !dailyReminder;
                  setDailyReminder(next);
                  void setDailyReminderEnabled(next).then(() => syncDailyReminderSchedule(next));
                }}
                testID="daily-reminder-toggle"
                accessibilityRole="switch"
                accessibilityState={{ checked: dailyReminder }}>
                <Text style={styles.cardBody}>Daily Check photo reminder</Text>
                <Text style={styles.email}>{dailyReminder ? 'On' : 'Off'}</Text>
              </Pressable>
              <Pressable
                style={styles.rowToggle}
                onPress={() => setShowAdvancedProfile((v) => !v)}
                testID="profile-advanced-fields-toggle"
                accessibilityRole="button">
                <Text style={styles.cardBody}>Budget · climate · procedure</Text>
                <Text style={styles.email}>{showAdvancedProfile ? 'Hide' : 'Show'}</Text>
              </Pressable>
              {showAdvancedProfile ? (
                <View style={{ gap: 8, marginTop: 8 }} testID="profile-collapsed-fields">
                  <TextInput
                    style={styles.input}
                    placeholder="Budget (low / mid / high)"
                    value={budgetBand}
                    onChangeText={setBudgetBand}
                    testID="profile-budget"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Climate (humid / dry / temperate)"
                    value={climateZone}
                    onChangeText={setClimateZone}
                    testID="profile-climate"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="ZIP / location"
                    value={zipInput}
                    onChangeText={setZipInput}
                    testID="profile-zip"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Procedure date YYYY-MM-DD"
                    value={procedureDate}
                    onChangeText={setProcedureDate}
                    testID="procedure-date-input-collapsed"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Procedure type"
                    value={procedureType}
                    onChangeText={setProcedureType}
                    testID="procedure-type-input-collapsed"
                  />
                  <ConsumerPrimaryButton
                    label="Save progressive fields"
                    onPress={() => {
                      void saveBioProfile({
                        budget_band: budgetBand.trim() || null,
                        climate_zone: climateZone.trim() || null,
                        zip: zipInput.trim() || null,
                        procedure_date: procedureDate.trim() || null,
                        procedure_type: procedureType.trim() || null,
                      })
                        .then((p) => {
                          setBioProfile(p);
                          showToast('Saved', 'success');
                        })
                        .catch((e: unknown) =>
                          showToast(e instanceof Error ? e.message : 'Could not save', 'error'),
                        );
                    }}
                  />
                </View>
              ) : null}

            </View>

            <View style={styles.card} testID="profile-conditions">
              <Text style={styles.cardTitle}>Skin profile</Text>
              <Text style={styles.cardBody}>
                {bioProfile?.conditions?.length
                  ? `Conditions: ${bioProfile.conditions.join(', ').replace(/_/g, ' ')}`
                  : 'No conditions saved yet.'}
                {bioProfile?.prescriptions?.length
                  ? `\nPrescriptions: ${bioProfile.prescriptions.join(', ')}`
                  : ''}
                {bioProfile?.procedure_date
                  ? `\nProcedure: ${bioProfile.procedure_type || 'procedure'} on ${bioProfile.procedure_date}`
                  : ''}
              </Text>
              <ConsumerPrimaryButton
                label="Edit skin profile"
                onPress={() => router.push(BIO_CALIBRATION_HREF)}
              />
            </View>

            <View style={styles.card} testID="procedure-safe-mode-fields">
              <Text style={styles.cardTitle}>Post-procedure safe mode</Text>
              <Text style={styles.cardBody}>
                Set a procedure date to pause actives during recovery (TOUCH-100).
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Procedure date YYYY-MM-DD"
                value={procedureDate}
                onChangeText={setProcedureDate}
                testID="procedure-date-input"
              />
              <TextInput
                style={styles.input}
                placeholder="Type (laser, peel, …)"
                value={procedureType}
                onChangeText={setProcedureType}
                testID="procedure-type-input"
              />
              <ConsumerPrimaryButton
                label="Save procedure date"
                onPress={() => {
                  void saveBioProfile({
                    procedure_date: procedureDate.trim() || null,
                    procedure_type: procedureType.trim() || null,
                  })
                    .then((p) => {
                      setBioProfile(p);
                      showToast('Procedure date saved', 'success');
                    })
                    .catch((e: unknown) =>
                      showToast(e instanceof Error ? e.message : 'Could not save', 'error'),
                    );
                }}
              />
            </View>

            <View style={styles.shopSection} testID="profile-member-banner">
              <Text style={styles.shopSectionLabel}>Shop touche</Text>
              <Text style={styles.shopSectionHint}>
                {isAppMember ? COMMERCE_COPY.memberBanner : COMMERCE_COPY.nonMemberBanner}
              </Text>
              <Pressable
                onPress={() => (commerceOn ? router.push(SHOP_HREF) : void Linking.openURL(TOUCHE_SKIN_COLLECTION_URL))}
                accessibilityRole="button"
                accessibilityLabel="Open shop"
                style={styles.shopLink}
                testID="profile-open-shop">
                <Text style={styles.shopLinkText}>{commerceOn ? 'Open in-app shop →' : 'Shop Skin Collection →'}</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.linkRow}
              onPress={() => router.push(ORDERS_HREF)}
              accessibilityRole="button"
              testID="profile-orders">
              <Text style={styles.linkLabel}>Orders</Text>
              <Text style={styles.linkChevron}>›</Text>
            </Pressable>

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
            <View style={{ height: 12 }} />
            <SecondaryButton
              label={deleteBusy ? 'Deleting…' : 'Delete account'}
              onPress={confirmDeleteAccount}
            />

            {/* TOUCH-011 — care_program buried below primary free loop + shop */}
            <Pressable
              onPress={() => setShowCareProgram((v) => !v)}
              style={styles.buriedToggle}
              accessibilityRole="button"
              accessibilityLabel="Journal subscription options">
              <Text style={styles.buriedToggleText}>
                {showCareProgram ? 'Hide journal subscription' : 'Journal subscription options'}
              </Text>
            </Pressable>
            {showCareProgram ? (
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
                <Text style={styles.subscriptionNote}>
                  Optional journal subscription · separate from product orders
                </Text>
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
                  <SecondaryButton
                    label={checkoutBusy ? 'Opening checkout…' : 'Subscribe'}
                    onPress={() => void startCareProgramCheckout()}
                  />
                ) : null}
              </View>
            ) : null}

            <Text style={styles.sessionNote}>
              Sessions stay signed in on this device for up to 24 hours, or until 60 minutes of inactivity.
            </Text>

            <View style={styles.footerSection}>
              <Text style={styles.poweredBy}>touche labs™</Text>
              <Pressable
                onPress={() => void Linking.openURL(TOUCHE_HOME_URL)}
                accessibilityRole="link"
                accessibilityLabel="Open trytouche.com">
                <Text style={styles.poweredByLink}>trytouche.com</Text>
              </Pressable>
            </View>

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
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  content: { padding: AppTokens.spacing.lg, gap: 14, paddingBottom: 100 },
  title: { fontFamily: AppTokens.font.display, fontSize: 28, color: AppTokens.color.ink },
  card: {
    backgroundColor: AppTokens.color.card,
    borderRadius: AppTokens.radius.md,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: AppTokens.spacing.md,
    gap: 8,
  },
  cardTitle: { fontWeight: '700', fontSize: 17, color: AppTokens.color.ink },
  cardBody: { color: AppTokens.color.muted, lineHeight: 20 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontFamily: AppTokens.font.body,
    backgroundColor: '#fff',
  },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  email: { fontSize: 15, color: AppTokens.color.ink, fontWeight: '600' },
  program: { fontSize: 14, color: AppTokens.color.muted, marginTop: 4 },
  programMuted: { fontSize: 14, color: AppTokens.color.muted, fontStyle: 'italic' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeNeutral: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextActive: { color: '#166534' },
  badgeTextNeutral: { color: '#64748b' },
  pricingMeta: { fontSize: 13, color: AppTokens.color.muted },
  shopSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: AppTokens.color.line,
  },
  shopSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppTokens.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  shopSectionHint: {
    fontSize: 13,
    color: AppTokens.color.muted,
    marginBottom: 8,
    lineHeight: 18,
  },
  shopLink: {
    paddingVertical: 10,
  },
  shopLinkText: {
    fontSize: 15,
    color: AppTokens.color.brandBlue,
    fontWeight: '500',
  },
  buriedToggle: {
    marginTop: 20,
    paddingVertical: 10,
  },
  buriedToggleText: {
    fontSize: 13,
    color: AppTokens.color.muted,
    textDecorationLine: 'underline',
  },
  subscriptionNote: {
    fontSize: 12,
    color: AppTokens.color.muted,
    marginBottom: 8,
    lineHeight: 17,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: AppTokens.color.line,
  },
  poweredBy: {
    fontSize: 11,
    color: AppTokens.color.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  poweredByLink: {
    fontSize: 11,
    color: AppTokens.color.brandBlue,
    textAlign: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppTokens.color.card,
    borderRadius: AppTokens.radius.md,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: AppTokens.spacing.md,
    minHeight: AppTokens.minTap,
  },
  linkLabel: { fontSize: 16, fontWeight: '600', color: AppTokens.color.ink },
  linkChevron: { fontSize: 22, color: AppTokens.color.muted },
  sessionNote: {
    color: AppTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 4,
  },
  disclaimer: {
    color: AppTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
