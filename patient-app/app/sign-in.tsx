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
import { HOME_HREF, LANDING_CONCERNS_HREF, LANDING_HOME_HREF, LANDING_ORIGIN, LANDING_SCAN_HREF } from '@/constants/routes';
import { resolvePostAuthRoute } from '@/hooks/useOnboardingGate';
import { clearPatientSession, getPatientSessionId, getStoredApiBase } from '@/lib/patient-session';
import { patientGet, patientPost } from '@/lib/patient-api';
import { isPatientSessionAuthError } from '@/lib/patient-auth';
import {
  clearPendingRoutineConcern,
  getPendingRoutineConcern,
} from '@/lib/routine-session';
import { completeSkinAgeJourney, hasSkinAgeJourneyData } from '@/lib/skin-age-journey';

function webSignupLabel(url: string): string {
  try {
    const host = new URL(url).host.replace(/^www\./, '');
    const path = new URL(url).pathname.replace(/^\//, '');
    return path ? `Open ${host}/${path}` : `Open ${host}`;
  } catch {
    return 'Open web signup';
  }
}

function getSignInBackHref(intent?: string, from?: string): string {
  if (intent === 'signup' && from === 'skin-age-landing') return LANDING_CONCERNS_HREF;
  if (intent === 'signup') return LANDING_SCAN_HREF;
  return LANDING_HOME_HREF;
}

function signInBackUrl(intent?: string, from?: string): string {
  const path = getSignInBackHref(intent, from);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${LANDING_ORIGIN}${path}`;
  }
  return `${LANDING_ORIGIN}${path}`;
}

function useSignInQueryParams() {
  const params = useLocalSearchParams<{ intent?: string; from?: string }>();
  return useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search);
      return {
        intent: (params.intent as string | undefined) ?? q.get('intent') ?? undefined,
        from: (params.from as string | undefined) ?? q.get('from') ?? undefined,
      };
    }
    return { intent: params.intent as string | undefined, from: params.from as string | undefined };
  }, [params.intent, params.from]);
}

export default function SignInScreen() {
  const router = useRouter();
  const { intent, from } = useSignInQueryParams();
  const [checkingSession, setCheckingSession] = useState(true);

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

  const onBack = useCallback(() => {
    const url = signInBackUrl(intent, from);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(url);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    void Linking.openURL(url);
  }, [intent, from, router]);

  useEffect(() => {
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
          router.replace(await resolvePostAuthRoute());
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          if (isPatientSessionAuthError(401, msg)) {
            await clearPatientSession();
          }
        }
      } catch {
        // stay on sign-in
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [router]);

  async function finishWithSession(sessionId?: string) {
    if (fromSkinAgeLanding && Platform.OS === 'web' && hasSkinAgeJourneyData() && sessionId) {
      const completed = await completeSkinAgeJourney(sessionId);
      if (completed) {
        const route = await resolvePostAuthRoute({ journeyModes: ['routine'] });
        if (route === HOME_HREF) {
          router.replace({ pathname: HOME_HREF, params: { celebrate: '1' } } as Href);
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
        router.replace(await resolvePostAuthRoute());
        return;
      } catch {
        await clearPendingRoutineConcern();
        router.replace({
          pathname: '/routine/pick',
          params: { concern: pendingConcern },
        } as Href);
        return;
      }
    }

    const route = await resolvePostAuthRoute();
    router.replace(route);
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
