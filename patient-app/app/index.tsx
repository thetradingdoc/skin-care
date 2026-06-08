import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { JournalTokens } from '@/constants/journalTokens';
import { resolveInitialRoute } from '@/hooks/useOnboardingGate';

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const route = await resolveInitialRoute();
      router.replace(route);
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
