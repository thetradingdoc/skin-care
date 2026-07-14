/**
 * TOUCH-071 / TOUCH-083 — Screen 17 Checkout handoff honesty interstitial.
 * No payment fields. Opens Shopify cart/PDP permalink then returns.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';
import { COMMERCE_COPY } from '@/constants/commerceCopy';
import { CHECK_HREF } from '@/constants/routes';
import { buildShopifyCartUrl, buildShopifyPdpUrl } from '@/constants/storeConfig';

const OPEN_MS = 700;

export default function CheckoutHandoffScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ variantId?: string; handle?: string; mode?: string }>();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          let url: string | null = null;
          if (params.mode === 'pdp' && params.handle) {
            url = buildShopifyPdpUrl(String(params.handle));
          } else if (params.variantId) {
            url = buildShopifyCartUrl(String(params.variantId));
          } else if (params.handle) {
            url = buildShopifyPdpUrl(String(params.handle));
          }
          if (url) {
            try {
              await WebBrowser.openBrowserAsync(url);
            } catch {
              await Linking.openURL(url);
            }
          }
        } finally {
          router.replace(CHECK_HREF);
        }
      })();
    }, OPEN_MS);
    return () => clearTimeout(t);
  }, [params.handle, params.mode, params.variantId, router]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.center} testID="checkout-handoff">
        <ActivityIndicator color={AppTokens.color.muted} />
        <Text style={styles.title}>{COMMERCE_COPY.handoffTitle}</Text>
        <Text style={styles.body}>{COMMERCE_COPY.handoffBody}</Text>
        <Text style={styles.muted}>{COMMERCE_COPY.handoffNoFields}</Text>
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
    padding: 28,
  },
  title: {
    fontFamily: AppTokens.font.display,
    fontSize: 22,
    color: AppTokens.color.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: AppTokens.font.body,
    fontSize: 15,
    color: AppTokens.color.ink,
    textAlign: 'center',
    lineHeight: 22,
  },
  muted: {
    fontFamily: AppTokens.font.body,
    fontSize: 13,
    color: AppTokens.color.muted,
    textAlign: 'center',
  },
});
