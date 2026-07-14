import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { JournalTokens } from '@/constants/journalTokens';
import { TRY_VERDICT_HREF } from '@/constants/routes';
import { resolveInitialRoute } from '@/hooks/useOnboardingGate';

const ROUTE_BUDGET_MS = 4000;

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const goTryVerdict = () => {
      if (cancelled) return;
      try {
        // TOUCH-013 failsafe: never dump to face-age funnel.
        router.replace(TRY_VERDICT_HREF);
      } catch (e) {
        console.error('[index] try-verdict replace failed', e);
      }
    };

    const failSafe = setTimeout(goTryVerdict, ROUTE_BUDGET_MS);

    void (async () => {
      try {
        const route = await Promise.race([
          resolveInitialRoute(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('resolveInitialRoute_timeout')), ROUTE_BUDGET_MS - 500);
          }),
        ]);
        if (cancelled) return;
        clearTimeout(failSafe);
        router.replace(route);
      } catch (e) {
        console.error('[index] resolveInitialRoute/replace failed', e);
        clearTimeout(failSafe);
        goTryVerdict();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
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
