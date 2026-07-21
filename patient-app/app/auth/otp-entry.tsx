/**
 * P7.38 — Screen 7b OTP entry (Step 6 — v4.1 chrome).
 * SEC-32: email via otp-flow-session (not nav params); never put OTP code in the URL.
 */
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { SIGN_IN_HREF, OTP_ERROR_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { getOtpFlowEmail, setOtpFlowEmail } from '@/lib/otp-flow-session';
import { patientPostPublic } from '@/lib/patient-api';
import { setPatientSession } from '@/lib/patient-session';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';
import { clearPendingCaptureToken, getPendingCaptureToken } from '@/lib/pending-capture-token';

export const OTP_ENTRY_TITLE = 'Enter the code';

export default function OtpEntryScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getOtpFlowEmail().then((e) => {
      if (e) setEmail(e);
    });
  }, []);

  const confirm = async () => {
    setBusy(true);
    try {
      const captureToken = await getPendingCaptureToken();
      const json = await patientPostPublic('/api/patient/verify/confirm', {
        email,
        code: code.trim(),
        ...(captureToken ? { capture_token: captureToken } : {}),
      });
      const sid = String(json.session_id || '');
      if (!sid) throw new Error('No session');
      if (json.capture_claim?.claimed) {
        await clearPendingCaptureToken();
      }
      await setPatientSession(sid);
      router.replace(await resolvePostAuthRoute());
    } catch {
      if (email) await setOtpFlowEmail(email);
      router.push(OTP_ERROR_HREF);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} testID="screen-7b-otp-entry" edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="otp-entry-back"
        onBack={() => router.replace(SIGN_IN_HREF)}
      />
      <View style={styles.content}>
        <Text style={styles.title} testID="otp-entry-title">
          {OTP_ENTRY_TITLE}
        </Text>
        <Text style={styles.sub} testID="otp-entry-email">
          {email ? `Sent to ${email}` : 'Sent to your email'}
        </Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="······"
          testID="otp-entry-code"
        />
        <Text style={styles.resendHint} testID="otp-entry-resend-hint">
          Resend available from the error screen if this code fails
        </Text>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.cta}
          testID="otp-entry-confirm"
          onPress={() => void confirm()}>
          <Text style={styles.ctaLabel}>{busy ? 'Confirming…' : 'Confirm'}</Text>
        </Pressable>
        <Pressable
          testID="otp-entry-different-email"
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
    marginBottom: 8,
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    marginBottom: 20,
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
  resendHint: {
    marginTop: 16,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
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
