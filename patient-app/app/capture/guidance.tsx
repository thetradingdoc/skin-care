/**
 * PIH v2 — Same-light tip (design ID: track-guidance).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_2A_HREF, PROGRESS_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

const SKIP_KEY = 'skincare_capture_guidance_skip';

export const GUIDANCE_TITLE = 'Same light, same spot';
export const GUIDANCE_BODY =
  'Match yesterday’s lighting and framing so your photos stay comparable.';

export async function shouldShowCaptureGuidance(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(SKIP_KEY);
    return v !== '1';
  } catch {
    return true;
  }
}

export default function CaptureGuidanceScreen() {
  const router = useRouter();

  const continueCapture = useCallback(async (skipForever: boolean) => {
    if (skipForever) {
      try {
        await AsyncStorage.setItem(SKIP_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    router.replace({ pathname: CAPTURE_2A_HREF, params: { entry: 'track' } } as never);
  }, [router]);

  return (
    <SafeAreaView style={styles.root} testID="screen-capture-guidance" edges={['top', 'bottom']}>
      <BackNavHeader label="Back" onBack={() => router.replace(PROGRESS_HREF)} />
      <View style={styles.body}>
        <Text style={styles.title} testID="guidance-title">
          {GUIDANCE_TITLE}
        </Text>
        <Text style={styles.sub}>{GUIDANCE_BODY}</Text>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.cta} testID="guidance-continue" onPress={() => void continueCapture(false)}>
          <Text style={styles.ctaLabel}>Continue to camera</Text>
        </Pressable>
        <Pressable testID="guidance-skip" onPress={() => void continueCapture(true)}>
          <Text style={styles.skip}>Don't show again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.ground },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.wine,
    textAlign: 'center',
  },
  sub: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 14,
    color: V4DesignTokens.color.muted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  footer: { padding: 22, gap: 12 },
  cta: {
    backgroundColor: V4DesignTokens.color.wine,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 15,
    color: V4DesignTokens.color.white,
  },
  skip: {
    textAlign: 'center',
    fontFamily: V4DesignTokens.font.bodySemiBold,
    fontSize: 13,
    color: V4DesignTokens.color.muted,
  },
});
