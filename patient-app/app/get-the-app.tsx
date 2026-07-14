/**
 * TOUCH-028/029 — iOS-only Get-the-App interstitial after OTP.
 * Copy is camera-only until TOUCH-114–116 ship in the same train.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { CHECK_HREF } from '@/constants/routes';
import { APP_STORE_URL } from '@/constants/storeConfig';
import { shouldShowGetTheAppInterstitial } from '@/lib/ios-web-gate';
import { trackFunnelEvent } from '@/lib/trackFunnelEvent';

export default function GetTheAppScreen() {
  const router = useRouter();

  useEffect(() => {
    // TOUCH-030: non-iOS must never see this screen.
    if (!shouldShowGetTheAppInterstitial()) {
      router.replace(CHECK_HREF);
    }
  }, [router]);

  const onDownload = useCallback(() => {
    void trackFunnelEvent('auth_handoff_app_link_shown', { surface: 'get_the_app_6c' });
    void Linking.openURL(APP_STORE_URL);
  }, []);

  const onContinue = useCallback(() => {
    void trackFunnelEvent('auth_handoff_continue_web', { surface: 'get_the_app_6c' });
    router.replace(CHECK_HREF);
  }, [router]);

  if (Platform.OS !== 'web' || !shouldShowGetTheAppInterstitial()) {
    return <SafeAreaView style={styles.root} />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.inner} testID="get-the-app-ios">
        <Text style={styles.title}>Get the app</Text>
        <Text style={styles.body}>
          Use the native camera for a clearer daily check — ghost alignment works best outside the browser.
        </Text>
        <Pressable
          style={styles.cta}
          onPress={onDownload}
          testID="get-the-app-download"
          accessibilityRole="button"
          accessibilityLabel="Download on the App Store">
          <Text style={styles.ctaText}>Download</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={onContinue}
          testID="get-the-app-continue"
          accessibilityRole="button"
          accessibilityLabel="Continue in browser">
          <Text style={styles.secondaryText}>Continue in browser</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  inner: {
    flex: 1,
    padding: AppTokens.spacing.lg,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 28,
    color: AppTokens.color.ink,
  },
  body: {
    fontFamily: AppTokens.font.body,
    fontSize: 15,
    color: AppTokens.color.muted,
    lineHeight: 22,
  },
  cta: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: {
    fontFamily: AppTokens.font.body,
    fontSize: 15,
    color: AppTokens.color.ink,
    textDecorationLine: 'underline',
  },
});
