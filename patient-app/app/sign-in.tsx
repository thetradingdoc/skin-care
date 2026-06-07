import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { PrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { API_BASE_URL, DEMO_PATIENT_EMAIL, getApiReachabilityIssue } from '@/config';
import { JournalTokens } from '@/constants/journalTokens';
import { PENDING_ROUTINE_CONCERN_KEY } from '@/constants/routineSession';
import { patientGet, patientPostPublic } from '@/lib/patient-api';
import { API_BASE_KEY, EMAIL_KEY, SESSION_KEY } from '@/lib/patient-session';

type Step = 'email' | 'code';

function formatFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : 'Network error';
  if (msg === 'Network request failed') {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  return msg;
}

export default function SignInScreen() {
  const router = useRouter();
  const apiIssue = getApiReachabilityIssue();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(DEMO_PATIENT_EMAIL || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const storedBase = await SecureStore.getItemAsync(API_BASE_KEY);
        if (storedBase && storedBase !== API_BASE_URL) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          await SecureStore.deleteItemAsync(EMAIL_KEY);
          await SecureStore.deleteItemAsync(API_BASE_KEY);
        }
        const sid = await SecureStore.getItemAsync(SESSION_KEY);
        if (!sid) return;
        const template = await patientGet('/api/patient/routine/template').catch(() => ({
          has_template: false,
        }));
        if (!template?.has_template) {
          router.replace('/routine/pick');
          return;
        }
        router.replace('/(tabs)/today');
      } catch {
        // stay on sign-in
      } finally {
        setCheckingSession(false);
      }
    })();
  }, [router]);

  async function finishWithSession(sessionId: string, confirmedEmail: string) {
    await SecureStore.setItemAsync(SESSION_KEY, sessionId);
    await SecureStore.setItemAsync(EMAIL_KEY, confirmedEmail.trim());
    await SecureStore.setItemAsync(API_BASE_KEY, API_BASE_URL);
    const pendingConcern = await SecureStore.getItemAsync(PENDING_ROUTINE_CONCERN_KEY);
    const template = await patientGet('/api/patient/routine/template').catch(() => ({
      has_template: false,
    }));
    if (!template?.has_template) {
      if (pendingConcern) await SecureStore.deleteItemAsync(PENDING_ROUTINE_CONCERN_KEY);
      router.replace({
        pathname: '/routine/pick',
        params: pendingConcern ? { concern: pendingConcern } : {},
      });
      return;
    }
    await SecureStore.deleteItemAsync(PENDING_ROUTINE_CONCERN_KEY);
    router.replace('/(tabs)/today');
  }

  async function sendCode() {
    if (apiIssue) {
      setError(apiIssue);
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await patientPostPublic('/api/patient/verify/send', { email: trimmed });
      setStep('code');
    } catch (e: unknown) {
      setError(formatFetchError(e));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode() {
    if (apiIssue) {
      setError(apiIssue);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await patientPostPublic('/api/patient/verify/confirm', {
        email: email.trim(),
        code: code.trim(),
      });
      const sid = String(json.session_id || '');
      if (!sid) throw new Error('Sign-in failed. Try again.');
      await finishWithSession(sid, email.trim());
    } catch (e: unknown) {
      setError(formatFetchError(e));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        <View style={styles.content}>
          <Text style={styles.brand}>Skin & Care</Text>
          <Text style={styles.title}>{step === 'email' ? 'Sign in' : 'Enter code'}</Text>
          <Text style={styles.subtitle}>
            {step === 'email'
              ? 'Track your skin with daily progress photos and a guided 12-week program.'
              : `We sent a 6-digit code to ${email.trim()}.`}
          </Text>

          {apiIssue ? <Text style={styles.warn}>{apiIssue}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'email' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="you@example.com"
                style={styles.input}
              />
              <PrimaryButton label={loading ? 'Sending…' : 'Send code'} onPress={() => void sendCode()} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification code</Text>
              <TextInput
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="123456"
                style={styles.input}
              />
              <PrimaryButton label={loading ? 'Verifying…' : 'Continue'} onPress={() => void confirmCode()} />
              <View style={{ height: 12 }} />
              <SecondaryButton label="Use a different email" onPress={() => setStep('email')} />
            </>
          )}

          <Text style={styles.disclaimer}>
            Not a diagnosis. See a dermatologist if your symptoms worsen or you are unsure.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  flex: { flex: 1 },
  content: { flex: 1, padding: JournalTokens.spacing.lg, gap: 10, justifyContent: 'center' },
  brand: {
    fontFamily: JournalTokens.font.display,
    fontSize: 32,
    fontWeight: '700',
    color: JournalTokens.color.ink,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: JournalTokens.color.ink },
  subtitle: { color: JournalTokens.color.muted, lineHeight: 22, marginBottom: 8 },
  label: { fontWeight: '600', color: JournalTokens.color.ink, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: JournalTokens.color.line,
    borderRadius: JournalTokens.radius.md,
    padding: 14,
    fontSize: 16,
    backgroundColor: JournalTokens.color.card,
    marginBottom: 8,
  },
  error: { color: JournalTokens.color.danger, fontSize: 14 },
  warn: { color: '#92400e', fontSize: 13, backgroundColor: '#fef3c7', padding: 10, borderRadius: 8 },
  disclaimer: { color: JournalTokens.color.muted, fontSize: 12, lineHeight: 18, marginTop: 20, textAlign: 'center' },
});
