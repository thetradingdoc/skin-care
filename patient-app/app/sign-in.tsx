import { useRouter, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';

import { OtpForm } from '@/components/OtpForm';
import { API_BASE_URL } from '@/config';
import { JournalTokens } from '@/constants/journalTokens';
import { PENDING_ROUTINE_CONCERN_KEY } from '@/constants/routineSession';
import { ROUTINE_PICK_HREF, TODAY_HREF } from '@/constants/routes';
import { patientGet } from '@/lib/patient-api';
import { API_BASE_KEY, EMAIL_KEY, SESSION_KEY } from '@/lib/patient-session';

const WEB_SIGNUP_URL = 'https://myskinandcare.com/scan';

export default function SignInScreen() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

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

  async function finishWithSession() {
    const pendingConcern = await SecureStore.getItemAsync(PENDING_ROUTINE_CONCERN_KEY);
    const template = await patientGet('/api/patient/routine/template').catch(() => ({
      has_template: false,
    }));
    if (template?.has_template) {
      await SecureStore.deleteItemAsync(PENDING_ROUTINE_CONCERN_KEY);
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
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.wrap}>
        <Text style={styles.brand}>Skin & Care</Text>
        <Text style={styles.newUser}>
          New here? Start on the web — scan your skin age, then create an account to save your track.
        </Text>
        <Pressable onPress={() => void Linking.openURL(WEB_SIGNUP_URL)} style={styles.webLinkWrap}>
          <Text style={styles.webLink}>Open myskinandcare.com/scan</Text>
        </Pressable>
        <OtpForm
          headline="Sign in"
          subtitle="Welcome back. Enter your email for a secure 6-digit code."
          onSuccess={() => finishWithSession()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: JournalTokens.color.cream },
  wrap: { flex: 1, padding: JournalTokens.spacing.lg },
  brand: {
    fontFamily: JournalTokens.font.display,
    fontSize: 32,
    fontWeight: '700',
    color: JournalTokens.color.ink,
    marginBottom: 8,
  },
  newUser: {
    color: JournalTokens.color.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  webLinkWrap: { marginBottom: 16 },
  webLink: {
    color: JournalTokens.color.accent,
    fontWeight: '700',
    fontSize: 14,
  },
});
