/**
 * P7.38 — Screen 7b OTP entry.
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
import { OTP_ERROR_HREF, SIGN_IN_HREF } from '@/constants/routes';
import { patientPostPublic } from '@/lib/patient-api';
import { setPatientSession } from '@/lib/patient-session';
import { resolvePostAuthRoute } from '@/lib/resolve-post-auth-route';
import { clearPendingCaptureToken, getPendingCaptureToken } from '@/lib/pending-capture-token';

export const OTP_ENTRY_TITLE = 'Enter your code';

export default function OtpEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = String(params.email || '').trim();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

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
      router.push({
        pathname: OTP_ERROR_HREF,
        params: { email, code },
      } as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SecondTierChrome testID="screen-7b-otp-entry">
      <View>
        <Text style={styles.title} testID="otp-entry-title">
          {OTP_ENTRY_TITLE}
        </Text>
        <Text style={styles.sub} testID="otp-entry-email">
          {email ? `sent to ${email}` : 'sent to your email'}
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
      </View>
      <View>
        <TierPrimary
          label={busy ? 'Confirming…' : 'Confirm'}
          testID="otp-entry-confirm"
          onPress={() => void confirm()}
        />
        <TierSecondary
          label="use a different email"
          testID="otp-entry-different-email"
          onPress={() => router.replace(SIGN_IN_HREF)}
        />
      </View>
    </SecondTierChrome>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 8 },
  sub: { fontSize: 15, color: AppTokens.color.muted, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 10,
    padding: 16,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
});
