/**
 * TOUCH-014 — Screen 2 handoff: light "continuing…" then Screen 3.
 * No second marketing pitch.
 */
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { TRY_VERDICT_HREF } from '@/constants/routes';

const REDIRECT_MS = 900;

export default function TryHandoffScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(TRY_VERDICT_HREF);
    }, REDIRECT_MS);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.center} testID="try-handoff">
        <ActivityIndicator color={AppTokens.color.muted} />
        <Text style={styles.primary}>continuing…</Text>
        <Text style={styles.secondary}>no login needed yet</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  primary: {
    fontFamily: AppTokens.font.body,
    fontSize: 16,
    color: AppTokens.color.ink,
  },
  secondary: {
    fontFamily: AppTokens.font.body,
    fontSize: 13,
    color: AppTokens.color.muted,
  },
});
