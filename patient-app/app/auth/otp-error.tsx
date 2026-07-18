/**
 * P7.39 — Screen 7c OTP error / resend.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import {
  SecondTierChrome,
  TierPrimary,
  TierSecondary,
} from '@/components/second-tier/SecondTierChrome';
import { AppTokens } from '@/constants/appTokens';
import { OTP_ENTRY_HREF, SIGN_IN_HREF } from '@/constants/routes';
import { patientPostPublic } from '@/lib/patient-api';

export const OTP_ERROR_MESSAGE = "that code's wrong or expired";
export const OTP_RESEND_LABEL = 'Resend code';

export default function OtpErrorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const email = String(params.email || '').trim();
  const [code, setCode] = useState(String(params.code || ''));
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const resend = async () => {
    if (!email) {
      router.replace(SIGN_IN_HREF);
      return;
    }
    setBusy(true);
    try {
      await patientPostPublic('/api/patient/verify/send', { email });
      setResent(true);
      router.replace({ pathname: OTP_ENTRY_HREF, params: { email } } as never);
    } catch {
      setResent(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecondTierChrome testID="screen-7c-otp-error">
      <View>
        <Text style={styles.title}>Enter your code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          testID="otp-error-code"
        />
        <Text style={styles.error} testID="otp-error-message">
          {OTP_ERROR_MESSAGE}
        </Text>
        {resent ? <Text style={styles.hint}>New code sent.</Text> : null}
      </View>
      <View>
        <TierPrimary
          label={busy ? 'Sending…' : OTP_RESEND_LABEL}
          testID="otp-error-resend"
          onPress={() => void resend()}
        />
        <TierSecondary
          label="use a different email"
          testID="otp-error-different-email"
          onPress={() => router.replace(SIGN_IN_HREF)}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    marginBottom: 12,
  },
  error: { color: AppTokens.color.danger, fontSize: 15, fontWeight: '500' },
  hint: { color: AppTokens.color.muted, marginTop: 8 },
});
