/**
 * Get-the-app — clones Step 1 Welcome chrome (red CTA, display type, white ground).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ToucheTulipMark } from '@/components/v4/ToucheTulipMark';
import { PROGRESS_HREF } from '@/constants/routes';
import { APP_STORE_URL } from '@/constants/storeConfig';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { shouldShowGetTheAppInterstitial } from '@/lib/ios-web-gate';
import { trackFunnelEvent } from '@/lib/trackFunnelEvent';

export default function GetTheAppScreen() {
  const router = useRouter();
  const [showInterstitial, setShowInterstitial] = useState<boolean | null>(null);

  useEffect(() => {
    // E2E / force: ?force_get_the_app=1 keeps the interstitial on non-iOS web.
    let force = false;
    try {
      if (typeof window !== 'undefined') {
        force = /force_get_the_app=1/.test(window.location.search || '');
      }
    } catch {
      force = false;
    }
    if (!force && !shouldShowGetTheAppInterstitial()) {
      setShowInterstitial(false);
      router.replace(PROGRESS_HREF);
      return;
    }
    setShowInterstitial(true);
  }, [router]);

  const onDownload = useCallback(() => {
    void trackFunnelEvent('auth_handoff_app_link_shown', { surface: 'get_the_app_6c' });
    void Linking.openURL(APP_STORE_URL);
  }, []);

  const onContinue = useCallback(() => {
    void trackFunnelEvent('auth_handoff_continue_web', { surface: 'get_the_app_6c' });
    router.replace(PROGRESS_HREF);
  }, [router]);

  if (showInterstitial !== true) {
    return <SafeAreaView style={styles.root} testID="get-the-app-pending" />;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']} testID="screen-get-the-app">
      <View style={styles.inner} testID="get-the-app-ios">
        <ToucheTulipMark color={V4DesignTokens.color.red} width={36} testID="get-the-app-tulip" />
        <Text style={styles.title} testID="get-the-app-title">
          Get the app
        </Text>
        <Text style={styles.body} testID="get-the-app-body">
          Use the native camera for a clearer daily check — ghost alignment works best outside the
          browser.
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
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 14,
  },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 28,
    color: V4DesignTokens.color.black,
  },
  body: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
    lineHeight: 22,
  },
  cta: {
    backgroundColor: V4DesignTokens.color.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontFamily: V4DesignTokens.font.bodyBold,
    color: V4DesignTokens.color.white,
    fontSize: 16,
  },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    color: V4DesignTokens.color.black,
    textDecorationLine: 'underline',
  },
});
