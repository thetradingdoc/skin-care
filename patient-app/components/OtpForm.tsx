import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/billing-ui';
import { DEMO_PATIENT_EMAIL, getApiReachabilityIssue } from '@/config';
import { JournalTokens } from '@/constants/journalTokens';
import { patientPostPublic } from '@/lib/patient-api';
import { setPatientSession } from '@/lib/patient-session';

type Step = 'email' | 'code';

function formatFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : 'Network error';
  if (msg === 'Network request failed') {
    return 'Unable to reach the server. Check your connection and try again.';
  }
  return msg;
}

type Props = {
  headline: string;
  subtitle: string;
  variant?: 'billing' | 'consumer';
  onSuccess: (sessionId: string, email: string) => void | Promise<void>;
};

export function OtpForm({ headline, subtitle, variant = 'billing', onSuccess }: Props) {
  const apiIssue = getApiReachabilityIssue();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(DEMO_PATIENT_EMAIL || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConsumer = variant === 'consumer';
  const btnVariant = isConsumer ? 'consumer' : 'billing';

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
      await setPatientSession(sid, email.trim());
      await onSuccess(sid, email.trim());
    } catch (e: unknown) {
      setError(formatFetchError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <View style={styles.content}>
        <Text style={[styles.title, isConsumer && styles.titleConsumer]}>
          {step === 'email' ? headline : 'Enter code'}
        </Text>
        <Text style={styles.subtitle}>
          {step === 'email' ? subtitle : `We sent a 6-digit code to ${email.trim()}.`}
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
              style={[styles.input, isConsumer && styles.inputConsumer]}
            />
            <PrimaryButton
              variant={btnVariant}
              label={loading ? 'Sending…' : 'Send code'}
              onPress={() => void sendCode()}
            />
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
              style={[styles.input, isConsumer && styles.inputConsumer]}
            />
            <PrimaryButton
              variant={btnVariant}
              label={loading ? 'Verifying…' : 'Continue'}
              onPress={() => void confirmCode()}
            />
            <View style={{ height: 12 }} />
            <SecondaryButton label="Use a different email" onPress={() => setStep('email')} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, gap: 10, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: JournalTokens.color.ink },
  titleConsumer: {
    fontFamily: JournalTokens.font.display,
    fontSize: 26,
    fontWeight: '400',
    color: JournalTokens.color.ink,
  },
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
    color: JournalTokens.color.ink,
  },
  inputConsumer: {
    borderRadius: JournalTokens.radius.pill,
    backgroundColor: '#ffffff',
    borderColor: JournalTokens.color.line,
  },
  error: { color: JournalTokens.color.danger, fontSize: 14 },
  warn: { color: '#92400e', fontSize: 13, backgroundColor: '#fef3c7', padding: 10, borderRadius: 8 },
});
