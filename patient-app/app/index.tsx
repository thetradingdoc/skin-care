import { usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { JournalTokens } from '@/constants/journalTokens';
import { WELCOME_HREF } from '@/constants/routes';
import { resolveInitialRoute } from '@/hooks/useOnboardingGate';

const ROUTE_BUDGET_MS = 4000;

/** True only for the SPA entry URL — never for deep links (sign-in, welcome, shop, …). */
function isEntryPath(pathname: string | null | undefined): boolean {
  const p = String(pathname || '').replace(/\/+$/, '') || '/';
  return p === '/' || p === '/index';
}

export default function IndexScreen() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    // Anchor `index` stays mounted under deep links. Never steal those URLs to Welcome.
    if (!isEntryPath(pathname)) {
      return;
    }

    const goWelcome = () => {
      if (cancelled) return;
      try {
        // Failsafe: signed-out cold start → Welcome (medical-tracker IA), never face-age.
        router.replace(WELCOME_HREF);
      } catch (e) {
        console.error('[index] welcome replace failed', e);
      }
    };

    const failSafe = setTimeout(goWelcome, ROUTE_BUDGET_MS);

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
        goWelcome();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, [router, pathname]);

  // Deep-link case: index is anchored but not the focused route — render nothing.
  if (!isEntryPath(pathname)) {
    return <View style={styles.root} />;
  }

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
