/**
 * Entry: boot fatal trap FIRST, force-dismiss splash ASAP, then Expo Router.
 */
import './lib/capture-fatal-boot';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const SplashScreen = require('expo-splash-screen');
  SplashScreen.hideAsync?.().catch?.(() => undefined);
  setTimeout(() => SplashScreen.hideAsync?.().catch?.(() => undefined), 300);
  setTimeout(() => SplashScreen.hideAsync?.().catch?.(() => undefined), 1500);
  setTimeout(() => SplashScreen.hideAsync?.().catch?.(() => undefined), 4000);
} catch {
  /* ignore */
}

import 'expo-router/entry';
