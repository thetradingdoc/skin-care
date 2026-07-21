/**
 * P7.39 — Screen 7c OTP error / resend (template-shared with Step 6).
 * SEC-32: email via otp-flow-session; never read/write OTP code from nav params.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { OTP_ENTRY_HREF, SIGN_IN_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { getOtpFlowEmail, setOtpFlowEmail } from '@/lib/otp-flow-session';
import { patientPostPublic } from '@/lib/patient-api';

export const OTP_ERROR_MESSAGE = "that code's wrong or expired";
export const OTP_RESEND_LABEL = 'Resend code';

export default function OtpErrorScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    void getOtpFlowEmail().then((e) => {
      if (e) setEmail(e);
    });
  }, []);

  const resend = async () => {
    if (!email) {
      router.replace(SIGN_IN_HREF);
      return;
    }
    setBusy(true);
    try {
      await patientPostPublic('/api/patient/verify/send', { email });
      await setOtpFlowEmail(email);
      setResent(true);
      setCode('');
      router.replace(OTP_ENTRY_HREF);
    } catch {
      setResent(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-7c-otp-error" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="otp-error-back"
        onBack={() => router.replace(SIGN_IN_HREF)}
      />
      <View style={styles.content}>
        <Text style={styles.title}>Enter the code</Text>
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
        {resent ? (
          <Text style={styles.hint} testID="otp-error-resent">
            New code sent.
          </Text>
        ) : null}
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="otp-error-resend"
          onPress={() => void resend()}>
          <Text style={styles.ctaLabel}>{busy ? 'Sending…' : OTP_RESEND_LABEL}</Text>
        </Pressable>
        <Pressable
          testID="otp-error-different-email"
          onPress={() => router.replace(SIGN_IN_HREF)}
          style={styles.secondary}>
          <Text style={styles.secondaryLabel}>use a different email</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  content: { flex: 1, paddingTop: 40, alignItems: 'center' },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 21,
    color: V4DesignTokens.color.black,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: V4DesignTokens.color.black,
    borderRadius: 9,
    width: '100%',
    maxWidth: 280,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.black,
  },
  error: {
    marginTop: 12,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.red,
    textAlign: 'center',
  },
  hint: {
    marginTop: 8,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
  footer: { paddingBottom: 16, gap: 10 },
  cta: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { alignItems: 'center', paddingVertical: 8 },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
  },
});
