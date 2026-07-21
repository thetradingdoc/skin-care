/**
 * Vision fail — clones Step 16 (Loading) chrome.
 * Real failure state with error-code-driven copy — not a stalled spinner.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackNavHeader } from '@/components/v4/BackNavHeader';
import { CAPTURE_2A_HREF, MANUAL_ENTRY_HREF } from '@/constants/routes';
import { V4DesignTokens } from '@/constants/v4DesignTokens';
import {
  VISION_FAIL_MANUAL,
  VISION_FAIL_RETRY,
  copyForCaptureFailure,
} from '@/lib/capture-failure-copy';

export {
  AV_BLOCKED_TITLE,
  QUALITY_FAIL_TITLE,
  VISION_FAIL_MANUAL,
  VISION_FAIL_RETRY,
  VISION_FAIL_TITLE,
  copyForCaptureFailure,
} from '@/lib/capture-failure-copy';

export default function VisionFailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ error_code?: string; reason?: string }>();
  const copy = copyForCaptureFailure({
    error_code: params.error_code,
    reason: params.reason,
  });

  return (
    <SafeAreaView style={styles.root} testID={copy.testID} edges={['top', 'bottom']}>
      <BackNavHeader
        label="Back"
        testID="vision-fail-back"
        onBack={() => router.replace(CAPTURE_2A_HREF)}
      />
      <View style={styles.body}>
        <Text style={styles.title} testID="vision-fail-title">
          {copy.title}
        </Text>
        <Text style={styles.copy} testID="vision-fail-body">
          {copy.body}
        </Text>
        {params.error_code ? (
          <Text style={styles.code} testID="vision-fail-error-code">
            {String(params.error_code)}
          </Text>
        ) : null}
        {/* Distinct from loading: never show a spinner here */}
        <View testID="vision-fail-not-spinner" />
      </View>
      <View style={styles.footer}>
        <Pressable
          style={styles.primary}
          testID="vision-fail-retry"
          onPress={() => router.replace(CAPTURE_2A_HREF)}
          accessibilityRole="button">
          <Text style={styles.primaryLabel}>{VISION_FAIL_RETRY}</Text>
        </Pressable>
        {copy.allowManual ? (
          <Pressable
            style={styles.secondary}
            testID="vision-fail-manual"
            onPress={() => router.push(MANUAL_ENTRY_HREF)}
            accessibilityRole="button">
            <Text style={styles.secondaryLabel}>{VISION_FAIL_MANUAL}</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V4DesignTokens.color.white, paddingHorizontal: 18 },
  body: { flex: 1, paddingTop: 12 },
  title: {
    fontFamily: V4DesignTokens.font.display,
    fontSize: 22,
    color: V4DesignTokens.color.black,
    marginBottom: 10,
  },
  copy: {
    fontFamily: V4DesignTokens.font.body,
    fontSize: 15,
    lineHeight: 22,
    color: V4DesignTokens.color.muted,
  },
  code: {
    marginTop: 12,
    fontFamily: V4DesignTokens.font.body,
    fontSize: 12,
    color: V4DesignTokens.color.muted,
  },
  footer: { paddingBottom: 12, gap: 8 },
  primary: {
    backgroundColor: V4DesignTokens.color.black,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontSize: 16,
    color: V4DesignTokens.color.white,
  },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 15,
    color: V4DesignTokens.color.muted,
  },
});
