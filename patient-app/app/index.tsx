import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { JournalTokens } from '@/constants/journalTokens';
import { SIGN_IN_HREF } from '@/constants/routes';
import { resolveInitialRoute } from '@/hooks/useOnboardingGate';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      try {
        const route = await resolveInitialRoute();
        router.replace(route);
      } catch (e) {
        // Avoid unhandled rejection → RCTFatal; fall back to sign-in.
        console.error('[index] resolveInitialRoute/replace failed', e);
        try {
          router.replace(SIGN_IN_HREF);
        } catch (navErr) {
          console.error('[index] fallback replace failed', navErr);
        }
      }
    })();
  }, [router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={JournalTokens.color.accent} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: JournalTokens.color.cream,
  },
});
