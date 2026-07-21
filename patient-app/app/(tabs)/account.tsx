/**
 * Step 32 — Profile hub (mock frame 32).
 * Identity from GET /me; plan from routine/template; billing from subscription.
 * Sign-out clears session — not a UI stub.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/billing-feedback';
import { ConsumerPrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { GoalsCard, JourneyModeCard } from '@/components/v3';
import {
  ALERTS_HISTORY_HREF,
  BILLING_CHOOSE_PLAN_HREF,
  BILLING_MANAGE_HREF,
  BIO_CALIBRATION_HREF,
  JOURNEY_CHOOSE_HREF,
  ORDERS_HREF,
  PROFILE_ALLERGENS_HREF,
  PROFILE_CONSENT_HREF,
  PROFILE_LANGUAGE_HREF,
  PROFILE_NOTIFICATIONS_HREF,
  PROFILE_SHARE_DOCTOR_HREF,
  PROGRESS_HREF,
  SHOP_HREF,
  SIGN_IN_HREF,
} from '@/constants/routes';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { COMMERCE_CTAS_LOCAL_OVERRIDE } from '@/constants/feature-flags';
import { MEMBER_DISCOUNT_CODE, TOUCHE_HOME_URL, TOUCHE_SKIN_COLLECTION_URL } from '@/constants/storeConfig';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { fetchBioProfile, saveBioProfile } from '@/lib/conflict-api';
import type { BioProfile } from '@/lib/conflict-types';
import { openBillingCheckoutUrl } from '@/lib/billing-platform-checkout';
import { dismissGoal, fetchGoals, type PatientGoal } from '@/lib/goals-api';
import {
  getJourneyProfile,
  toggleJourneyMode,
  type JourneyMode,
} from '@/lib/journey-mode-storage';
import { patientGet, patientPost } from '@/lib/patient-api';
import { clearPatientSession, getStoredEmail } from '@/lib/patient-session';
import {
  getAdvancedSeverityEnabled,
  setAdvancedSeverityEnabled,
} from '@/lib/advanced-severity-pref';
import {
  getDailyReminderEnabled,
  setDailyReminderEnabled,
  syncDailyReminderSchedule,
} from '@/lib/push-reminders';
import { trackPortalEvent } from '@/lib/trackPortalEvent';

type PlanTier = 'free' | 'care_program' | 'plus';

type CareProgramPricing = {
  monthly_price_cents?: number;
  currency?: string;
  description?: string;
};

function displayNameFromMe(me: { patient?: { name?: string } } | null, email: string | null) {
  const n = String(me?.patient?.name || '').trim();
  if (n && n.toLowerCase() !== 'patient') return n;
  if (email) {
    const local = email.split('@')[0] || '';
    if (local) return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return 'You';
}

function initialFromName(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

export default function AccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subscription?: string }>();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('You');
  const [programName, setProgramName] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier>('free');
  const [carePricing, setCarePricing] = useState<CareProgramPricing | null>(null);
  const [walletEnabled, setWalletEnabled] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [showCareProgram, setShowCareProgram] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [bioProfile, setBioProfile] = useState<BioProfile | null>(null);
  const [journeyModes, setJourneyModes] = useState<JourneyMode[]>([]);
  const [goals, setGoals] = useState<PatientGoal[]>([]);
  const [advancedSeverity, setAdvancedSeverity] = useState(false);
  const [dailyReminder, setDailyReminder] = useState(false);
  const [procedureDate, setProcedureDate] = useState('');
  const [procedureType, setProcedureType] = useState('');
  const [allergensList, setAllergensList] = useState<
    Array<{ allergen_class: string; label?: string }>
  >([]);
  const [budgetBand, setBudgetBand] = useState('');
  const [climateZone, setClimateZone] = useState('');
  const [zipInput, setZipInput] = useState('');
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);
  const [isAppMember, setIsAppMember] = useState(false);
  const [commerceOn, setCommerceOn] = useState(COMMERCE_CTAS_LOCAL_OVERRIDE);
  const [aiReadsLabel, setAiReadsLabel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const storedEmail = await getStoredEmail();
      if (!storedEmail) {
        setSignedIn(false);
        setEmail(null);
        setProgramName(null);
        setPlanTier('free');
        setDisplayName('You');
        return;
      }
      setSignedIn(true);
      setEmail(storedEmail);

      const [me, template, sub, features, bio] = await Promise.all([
        patientGet('/api/patient/me').catch(() => null),
        patientGet('/api/patient/routine/template').catch(() => null),
        patientGet('/api/patient/billing/subscription').catch(() => null),
        patientGet('/api/patient/features').catch(() => null),
        fetchBioProfile().catch(() => null),
      ]);
      setDisplayName(displayNameFromMe(me, storedEmail));
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

      try {
        const usage = await patientGet('/api/patient/ai/usage');
        const used = Number(usage?.monthly_used ?? usage?.used ?? 0);
        const limit = Number(usage?.monthly_limit ?? usage?.limit ?? 20);
        setAiReadsLabel(`${used} of ${limit} AI reads`);
      } catch {
        setAiReadsLabel(null);
      }

      if (template?.has_template && template?.template?.name) {
        setProgramName(String(template.template.name));
      } else {
        setProgramName(null);
      }

      const tierRaw = String(sub?.subscription?.tier || 'free').toLowerCase();
      setPlanTier(
        tierRaw === 'care_program' ? 'care_program' : tierRaw === 'plus' ? 'plus' : 'free',
      );
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
      await openBillingCheckoutUrl(url);
      await load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not start checkout', 'error');
    } finally {
      setCheckoutBusy(false);
    }
  }

  const monthlyLabel = carePricing?.monthly_price_cents
    ? `$${(carePricing.monthly_price_cents / 100).toFixed(0)}/mo`
    : null;

  const billingSubtitle =
    planTier === 'care_program'
      ? `Care Program${monthlyLabel ? ` · ${monthlyLabel}` : ''}`
      : planTier === 'plus'
        ? `Plus${monthlyLabel ? ` · ${monthlyLabel}` : ''}`
        : 'Free';

  const planRowTitle = programName
    ? /plan$/i.test(programName.trim())
      ? programName.trim()
      : `${programName.trim()} plan`
    : 'No active plan';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} testID="profile-title">
          Profile
        </Text>

        {loading ? (
          <ActivityIndicator color={V4DesignTokens.color.red} />
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
            <View style={styles.identity} testID="profile-identity">
              <View style={styles.avatar} testID="profile-avatar">
                <Text style={styles.avatarText}>{initialFromName(displayName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} testID="profile-display-name">
                  {displayName}
                </Text>
                {email ? (
                  <Text style={styles.email} testID="profile-email">
                    {email}
                  </Text>
                ) : null}
              </View>
            </View>

            <Pressable
              style={styles.recRow}
              onPress={() => router.push('/profile/protocol' as never)}
              testID="profile-plan-row">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>✦</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle} testID="profile-plan-name">
                  {planRowTitle}
                </Text>
                <Text style={styles.recSub}>Your protocol</Text>
              </View>
            </Pressable>

            <View style={styles.journalCodeCard} testID="profile-journal20">
              <Text style={styles.journalCodeLbl}>Your member code</Text>
              <Text style={styles.journalCode}>{MEMBER_DISCOUNT_CODE}</Text>
              <Text style={styles.journalCodeSub}>20% off at checkout</Text>
            </View>

            <Pressable
              style={styles.recRow}
              onPress={() => router.push(BILLING_MANAGE_HREF)}
              testID="profile-billing-row">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>$</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle}>Billing</Text>
                <Text style={styles.recSub} testID="profile-billing-status">
                  {billingSubtitle}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.recRow}
              onPress={() => router.push(PROFILE_SHARE_DOCTOR_HREF)}
              testID="profile-share-doctor-row">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>⚕</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle}>Share with doctor</Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.recRow}
              onPress={() => router.push(PROFILE_ALLERGENS_HREF)}
              testID="profile-allergens">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>⚠</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle}>Allergens</Text>
                <Text style={styles.recSub}>
                  {allergensList.length
                    ? allergensList.map((a) => a.label || a.allergen_class).join(', ')
                    : 'Nothing ruled out yet'}
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.recRow}
              onPress={() => router.push('/profile/records' as never)}
              testID="profile-records-row">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>📋</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle}>Medical records (advanced)</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.recRow, styles.recRowLast]}
              onPress={() => router.push(PROFILE_NOTIFICATIONS_HREF)}
              testID="profile-notifications-row">
              <View style={styles.recIcon}>
                <Text style={styles.recGlyph}>🔔</Text>
              </View>
              <View style={styles.recMeta}>
                <Text style={styles.recTitle}>Notifications</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push('/profile/sign-out' as never)}
              style={styles.signOut}
              accessibilityRole="button"
              testID="profile-sign-out">
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowMore((v) => !v)}
              style={styles.moreToggle}
              testID="profile-more-toggle">
              <Text style={styles.moreToggleText}>{showMore ? 'Hide more' : 'More'}</Text>
            </Pressable>

            {showMore ? (
              <>
                {aiReadsLabel ? (
                  <View style={styles.card} testID="profile-ai-reads-meter">
                    <Text style={styles.cardTitle}>AI reads</Text>
                    <Text style={styles.cardBody} testID="profile-ai-reads-label">
                      {aiReadsLabel} this month — manual entries stay free.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Your journeys</Text>
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
                      void toggleJourneyMode('routine', !journeyModes.includes('routine')).then(
                        (p) => setJourneyModes(p.modes),
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
                          showToast(
                            e instanceof Error ? e.message : 'Could not update goal',
                            'error',
                          ),
                        );
                    }}
                  />
                </View>

                <View style={styles.card} testID="profile-language-row">
                  <Text style={styles.cardTitle}>Language</Text>
                  <ConsumerPrimaryButton
                    label="Language"
                    onPress={() => router.push(PROFILE_LANGUAGE_HREF)}
                  />
                </View>

                <View style={styles.card} testID="profile-alerts-history-row">
                  <Text style={styles.cardTitle}>Alerts history</Text>
                  <ConsumerPrimaryButton
                    label="View alerts history"
                    onPress={() => router.push(ALERTS_HISTORY_HREF)}
                  />
                </View>

                <View style={styles.card} testID="profile-consent-row">
                  <Text style={styles.cardTitle}>Consent & privacy</Text>
                  <ConsumerPrimaryButton
                    label="View consent & privacy"
                    onPress={() => router.push(PROFILE_CONSENT_HREF)}
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
                      void setDailyReminderEnabled(next).then(() =>
                        syncDailyReminderSchedule(next),
                      );
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
                              showToast(
                                e instanceof Error ? e.message : 'Could not save',
                                'error',
                              ),
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
                  </Text>
                  <ConsumerPrimaryButton
                    label="Edit skin profile"
                    onPress={() => router.push(BIO_CALIBRATION_HREF)}
                  />
                </View>

                <View style={styles.card} testID="procedure-safe-mode-fields">
                  <Text style={styles.cardTitle}>Post-procedure safe mode</Text>
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
                          showToast(
                            e instanceof Error ? e.message : 'Could not save',
                            'error',
                          ),
                        );
                    }}
                  />
                </View>

                <View style={styles.shopSection} testID="profile-member-banner">
                  <Text style={styles.shopSectionLabel}>Shop skiñcare</Text>
                  <Text style={styles.shopSectionHint}>
                    {isAppMember ? COMMERCE_COPY.memberBanner : COMMERCE_COPY.nonMemberBanner}
                  </Text>
                  <Pressable
                    onPress={() =>
                      commerceOn
                        ? router.push(SHOP_HREF)
                        : void Linking.openURL(TOUCHE_SKIN_COLLECTION_URL)
                    }
                    style={styles.shopLink}
                    testID="profile-open-shop">
                    <Text style={styles.shopLinkText}>
                      {commerceOn ? 'Open in-app shop →' : 'Shop Skin Collection →'}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push(ORDERS_HREF)}
                  testID="profile-orders">
                  <Text style={styles.linkLabel}>Orders</Text>
                  <Text style={styles.linkChevron}>›</Text>
                </Pressable>

                {walletEnabled ? (
                  <Pressable style={styles.linkRow} onPress={() => router.push(PROGRESS_HREF)}>
                    <Text style={styles.linkLabel}>Bills & receipts</Text>
                    <Text style={styles.linkChevron}>›</Text>
                  </Pressable>
                ) : null}

                {planTier === 'free' ? (
                  <SecondaryButton
                    label="Choose a plan"
                    onPress={() => router.push(BILLING_CHOOSE_PLAN_HREF)}
                  />
                ) : null}

                <SecondaryButton label="Change program" onPress={() => router.push('/routine/pick')} />
                <View style={{ height: 12 }} />
                <SecondaryButton
                  label={deleteBusy ? 'Deleting…' : 'Delete account'}
                  onPress={() => router.push('/profile/delete-account' as never)}
                />

                <Pressable
                  onPress={() => setShowCareProgram((v) => !v)}
                  style={styles.buriedToggle}
                  accessibilityRole="button">
                  <Text style={styles.buriedToggleText}>
                    {showCareProgram ? 'Hide journal subscription' : 'Journal subscription options'}
                  </Text>
                </Pressable>
                {showCareProgram ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Program subscription</Text>
                    <Text style={styles.cardBody}>
                      {planTier === 'care_program'
                        ? 'Your guided skin program subscription is active.'
                        : 'Subscribe to unlock the full 12-week guided tracking program.'}
                    </Text>
                    {planTier !== 'care_program' ? (
                      <SecondaryButton
                        label={checkoutBusy ? 'Opening checkout…' : 'Subscribe'}
                        onPress={() => void startCareProgramCheckout()}
                      />
                    ) : null}
                  </View>
                ) : null}

                <Text style={styles.sessionNote}>
                  Sessions stay signed in on this device for up to 24 hours, or until 60 minutes of
                  inactivity.
                </Text>
                <View style={styles.footerSection}>
                  <Text style={styles.poweredBy}>skiñcare</Text>
                  <Pressable onPress={() => void Linking.openURL(TOUCHE_HOME_URL)}>
                    <Text style={styles.poweredByLink}>trytouche.com</Text>
                  </Pressable>
                </View>
                <Text style={styles.disclaimer}>
                  Not a diagnosis. See a dermatologist if your symptoms worsen or you are unsure.
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  content: { padding: 20, gap: 4, paddingBottom: 100 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 26,
    color: V4DesignTokens.color.black,
    marginBottom: 8,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: V4DesignTokens.color.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    color: V4DesignTokens.color.white,
  },
  name: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 14.5,
    color: V4DesignTokens.color.black,
  },
  email: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 10.5,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V4DesignTokens.color.line,
  },
  recRowLast: { borderBottomWidth: 0 },
  recIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F6F6F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recGlyph: { color: V4DesignTokens.color.red, fontSize: 14, fontWeight: '700' },
  recMeta: { flex: 1 },
  recTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 14,
    color: V4DesignTokens.color.black,
  },
  recSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  signOut: { marginTop: 18, paddingVertical: 8 },
  journalCodeCard: {
    backgroundColor: V4DesignTokens.color.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.line,
    padding: 14,
    marginBottom: 10,
  },
  journalCodeLbl: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 11,
    color: V4DesignTokens.color.muted,
    marginBottom: 4,
  },
  journalCode: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 18,
    letterSpacing: 0.8,
    color: V4DesignTokens.color.wine,
  },
  journalCodeSub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    marginTop: 2,
  },
  signOutText: {
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 15,
    color: V4DesignTokens.color.red,
  },
  moreToggle: { marginTop: 8, paddingVertical: 8 },
  moreToggleText: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textDecorationLine: 'underline',
  },
  card: {
    backgroundColor: '#F6F6F6',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  cardTitle: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  cardBody: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    lineHeight: 20,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: V4DesignTokens.color.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontFamily: V4DesignTokens.font.body,
    backgroundColor: '#fff',
  },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  shopSection: {
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: V4DesignTokens.color.line,
  },
  shopSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: V4DesignTokens.color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  shopSectionHint: {
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    marginBottom: 8,
    lineHeight: 18,
  },
  shopLink: { paddingVertical: 10 },
  shopLinkText: {
    fontSize: 15,
    color: V4DesignTokens.color.red,
    fontWeight: '500',
  },
  buriedToggle: { marginTop: 20, paddingVertical: 10 },
  buriedToggleText: {
    fontSize: 13,
    color: V4DesignTokens.color.muted,
    textDecorationLine: 'underline',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: V4DesignTokens.color.black,
  },
  linkChevron: { fontSize: 22, color: V4DesignTokens.color.muted },
  sessionNote: {
    color: V4DesignTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 12,
  },
  footerSection: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: V4DesignTokens.color.line,
  },
  poweredBy: {
    fontSize: 11,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    marginBottom: 4,
  },
  poweredByLink: {
    fontSize: 11,
    color: V4DesignTokens.color.red,
    textAlign: 'center',
  },
  disclaimer: {
    color: V4DesignTokens.color.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
});
