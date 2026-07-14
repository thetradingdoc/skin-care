// PR1 soft-launch safety — 2026-07-12
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OtpForm } from '@/components/OtpForm';
import { AppTokens } from '@/constants/appTokens';
import { API_BASE_URL, WEB_SIGNUP_URL } from '@/config';
import { FOOTER_TAGLINE } from '@/constants/brandCopy';
import { JournalTokens } from '@/constants/journalTokens';
import {
  CHECK_HREF,
  GET_THE_APP_HREF,
  HOME_HREF,
  INDEX_HREF,
  TRY_VERDICT_HREF,
} from '@/constants/routes';
import { resolvePostAuthRoute } from '@/hooks/useOnboardingGate';
import { clearPatientSession, getPatientSessionId, getStoredApiBase } from '@/lib/patient-session';
import { patientGet, patientPost } from '@/lib/patient-api';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import { shouldShowGetTheAppInterstitial } from '@/lib/ios-web-gate';
import {
  clearPendingRoutineConcern,
  getPendingRoutineConcern,
} from '@/lib/routine-session';
import { completeSkinAgeJourney, hasSkinAgeJourneyData } from '@/lib/skin-age-journey';
import {
  clearPendingAllergens,
  clearPendingTryProduct,
  getPendingAllergens,
  getPendingTryProduct,
} from '@/lib/try-verdict-session';

function webSignupLabel(url: string): string {
  try {
    const host = new URL(url).host.replace(/^www\./, '');
    const path = new URL(url).pathname.replace(/^\//, '');
    return path ? `Open ${host}/${path}` : `Open ${host}`;
  } catch {
    return 'Open web signup';
  }
}

function useSignInQueryParams() {
  const params = useLocalSearchParams<{ intent?: string; from?: string; error?: string }>();
  return useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      return {
        intent: (params.intent as string | undefined) ?? q.get('intent') ?? undefined,
        from: (params.from as string | undefined) ?? q.get('from') ?? undefined,
        error: (params.error as string | undefined) ?? q.get('error') ?? undefined,
      };
    }
    return {
      intent: params.intent as string | undefined,
      from: params.from as string | undefined,
      error: params.error as string | undefined,
    };
  }, [params.intent, params.from, params.error]);
}

export default function SignInScreen() {
  const router = useRouter();
  const { intent, from, error: errorParam } = useSignInQueryParams();
  const [checkingSession, setCheckingSession] = useState(true);
  const showConnectionError = errorParam === 'connection';

  const isSignupIntent = intent === 'signup';
  const fromSkinAgeLanding = from === 'skin-age-landing';

  const copy = useMemo(() => {
    if (isSignupIntent && fromSkinAgeLanding) {
      return {
        headline: 'Save your journal',
        subtitle: 'Enter your email to save your face check and daily photo log.',
        showWebCta: false,
      };
    }
    if (isSignupIntent) {
      return {
        headline: 'Create account',
        subtitle: 'Enter your email for a secure 6-digit code.',
        showWebCta: true,
      };
    }
    return {
      headline: 'Sign in',
      subtitle: 'Welcome back. Enter your email for a secure 6-digit code.',
      showWebCta: false,
    };
  }, [isSignupIntent, fromSkinAgeLanding]);

  /**
   * TOUCH-004/005 + Phase 1: stay in-app forever on web.
   * Prefer try-verdict (Screen 3) over marketing Safari dump.
   */
  const onBack = useCallback(() => {
    if (Platform.OS === 'web') {
      router.replace(TRY_VERDICT_HREF);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(TRY_VERDICT_HREF);
  }, [router]);

  const onRetryConnection = useCallback(() => {
    router.replace(INDEX_HREF);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const failSafe = setTimeout(() => {
      if (!cancelled) setCheckingSession(false);
    }, 3000);

    void (async () => {
      try {
        const storedBase = await getStoredApiBase();
        if (storedBase && storedBase !== API_BASE_URL) {
          await clearPatientSession();
        }
        const sid = await getPatientSessionId();
        if (!sid) return;
        try {
          await patientGet('/api/patient/me');
          if (cancelled) return;
          router.replace(await resolvePostAuthRoute());
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          // Message-only auth check (do not hardcode status 401)
          if (isPatientSessionAuthError(0, msg)) {
            await clearPatientSession();
          }
        }
      } catch {
        // stay on sign-in
      } finally {
        if (!cancelled) setCheckingSession(false);
        clearTimeout(failSafe);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [router]);

  async function finishWithSession(sessionId?: string) {
    // TOUCH-018 — persist pre-signup allergen exclusions to profile.
    try {
      const allergens = await getPendingAllergens();
      if (allergens.length) {
        await patientPost('/api/patient/allergens', { allergens });
        await clearPendingAllergens();
      }
    } catch {
      /* non-blocking — user can re-edit later */
    }

    // TOUCH-026 — pending anonymous product → shelf after verify.
    try {
      const pending = await getPendingTryProduct();
      if (pending && (pending.product_name || pending.query || pending.barcode)) {
        if (pending.barcode && pending.barcode !== 'scan_pending') {
          await patientPost('/api/patient/shelf/products/scan', { barcode: pending.barcode }).catch(
            async () => {
              await patientPost('/api/patient/shelf/products', {
                product_name: pending.product_name || pending.query || pending.barcode,
                barcode: pending.barcode,
                ingredients_text: pending.ingredients_text,
              });
            },
          );
        } else {
          await patientPost('/api/patient/shelf/products', {
            product_name: pending.product_name || pending.query || 'Tried product',
            ingredients_text: pending.ingredients_text,
          });
        }
        await clearPendingTryProduct();
      }
    } catch {
      /* shelf restore best-effort */
    }

    if (fromSkinAgeLanding && Platform.OS === 'web' && hasSkinAgeJourneyData() && sessionId) {
      const completed = await completeSkinAgeJourney(sessionId);
      if (completed) {
        const route = await resolvePostAuthRoute({ journeyModes: ['routine'] });
        if (route === HOME_HREF || route === CHECK_HREF) {
          router.replace(CHECK_HREF);
        } else {
          router.replace(route);
        }
        return;
      }
    }

    const pendingConcern = await getPendingRoutineConcern();
    if (pendingConcern) {
      try {
        await patientPost('/api/patient/routine/template', { concern_id: pendingConcern });
        await clearPendingRoutineConcern();
      } catch {
        await clearPendingRoutineConcern();
      }
    }

    // TOUCH-027/028/030 — iOS web → 6c; Android/desktop → Check.
    if (shouldShowGetTheAppInterstitial()) {
      router.replace(GET_THE_APP_HREF);
      return;
    }
    router.replace(CHECK_HREF);
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.brandAccent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.wrap}>
        <Pressable
          onPress={onBack}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={20} color={JournalTokens.color.muted} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        {showConnectionError ? (
          <View style={styles.connectionBanner}>
            <Text style={styles.connectionText}>
              Connection error — check your network and try again.
            </Text>
            <Pressable
              onPress={onRetryConnection}
              style={styles.retryBtn}
              accessibilityRole="button"
              accessibilityLabel="Retry connection">
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {copy.showWebCta ? (
          <>
            <Text style={styles.newUser}>
              New here? Start with a free skin scan, then create an account to save your track.
            </Text>
            <Pressable onPress={() => void Linking.openURL(WEB_SIGNUP_URL)} style={styles.webLinkWrap}>
              <Text style={styles.webLink}>{webSignupLabel(WEB_SIGNUP_URL)}</Text>
            </Pressable>
          </>
        ) : null}
        <OtpForm
          variant="consumer"
          headline={copy.headline}
          subtitle={copy.subtitle}
          onSuccess={(sid) => finishWithSession(sid)}
        />
        {isSignupIntent ? (
          <Text style={styles.legal}>
            By continuing you agree to our Privacy Policy and Terms at myskinandcare.com/patients/legal/.
          </Text>
        ) : null}
        <Text style={styles.tagline}>{FOOTER_TAGLINE}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  wrap: { flex: 1, padding: JournalTokens.spacing.lg },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: JournalTokens.color.muted,
  },
  connectionBanner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: AppTokens.color.pageBg,
    borderWidth: 1,
    borderColor: JournalTokens.color.muted,
  },
  connectionText: {
    color: JournalTokens.color.ink,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  retryText: {
    color: JournalTokens.color.brandAccent,
    fontWeight: '700',
    fontSize: 14,
  },
  newUser: {
    color: JournalTokens.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  webLinkWrap: { marginBottom: 16 },
  webLink: {
    color: JournalTokens.color.brandAccent,
    fontWeight: '700',
    fontSize: 14,
  },
  legal: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 17,
    color: JournalTokens.color.muted,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    fontFamily: JournalTokens.font.display,
    color: JournalTokens.color.ink,
  },
});
