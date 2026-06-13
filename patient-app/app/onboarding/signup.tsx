import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtpForm } from '@/components/OtpForm';
import { AppTokens } from '@/constants/appTokens';
import { JournalTokens } from '@/constants/journalTokens';
import { completeOnboardingAfterSignup } from '@/lib/onboarding-complete';

export default function OnboardingSignupScreen() {
  const router = useRouter();
  const [finishing, setFinishing] = useState(false);

  async function onSuccess() {
    setFinishing(true);
    try {
      await completeOnboardingAfterSignup();
      router.replace({
        pathname: '/(tabs)/home',
        params: { celebrate: '1', photo: '1' },
      });
    } catch {
      setFinishing(false);
    }
  }

  if (finishing) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={JournalTokens.color.accent} style={{ marginTop: 48 }} />
        <Text style={styles.loadingText}>Setting up your program…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.wrap}>
        <Text style={styles.brand}>Skin & Care</Text>
        <OtpForm
          headline="Create your account"
          subtitle="Save your journal and start logging daily photos. Free to start."
          onSuccess={() => onSuccess()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  wrap: { flex: 1, padding: JournalTokens.spacing.lg },
  brand: {
    fontFamily: JournalTokens.font.display,
    fontSize: 28,
    fontWeight: '700',
    color: JournalTokens.color.ink,
    marginBottom: 16,
  },
  loadingText: { textAlign: 'center', color: JournalTokens.color.muted, marginTop: 12 },
});
