import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandWordmark } from '@/components/BrandWordmark';
import { OtpForm } from '@/components/OtpForm';
import { API_BASE_URL, WEB_SIGNUP_URL } from '@/config';
import { FOOTER_TAGLINE } from '@/constants/brandCopy';
import { JournalTokens } from '@/constants/journalTokens';
import { PENDING_ROUTINE_CONCERN_KEY } from '@/constants/routineSession';
import { ROUTINE_PICK_HREF, TODAY_HREF } from '@/constants/routes';
import { patientGet } from '@/lib/patient-api';
import { clearPatientSession, getPatientSessionId, getStoredApiBase } from '@/lib/patient-session';
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
  if (intent === 'signup' && from === 'skin-age-landing') return '/concerns';
  if (intent === 'signup') return '/scan';
  return '/';
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
        headline: 'Save your plan',
        subtitle: 'Enter your email to save your skin age and 12-week track.',
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
    const href = getSignInBackHref(intent, from);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(href);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    void Linking.openURL(`https://myskinandcare.com${href}`);
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
        const template = await patientGet('/api/patient/routine/template').catch(() => ({
          has_template: false,
        }));
        if (template?.has_template) {
          router.replace(TODAY_HREF);
          return;
        }
        router.replace(ROUTINE_PICK_HREF);
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
        router.replace('/(tabs)/today?celebrate=1' as Href);
        return;
      }
    }

    let pendingConcern: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      pendingConcern = localStorage.getItem(PENDING_ROUTINE_CONCERN_KEY);
    }
    const template = await patientGet('/api/patient/routine/template').catch(() => ({
      has_template: false,
    }));
    if (template?.has_template) {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(PENDING_ROUTINE_CONCERN_KEY);
      }
      router.replace(TODAY_HREF);
      return;
    }
    router.replace({
      pathname: '/routine/pick',
      params: pendingConcern ? { concern: pendingConcern } : {},
    } as Href);
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
        <BrandWordmark height={40} />
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
  root: { flex: 1, backgroundColor: '#FFFFFF' },
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
