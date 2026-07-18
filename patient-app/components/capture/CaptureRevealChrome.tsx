import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';

/**
 * Dumb chrome only — no tag switching, no copy. Each 5b reveal owns its strings.
 */
export function CaptureRevealChrome({
  testID,
  children,
}: {
  testID: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.root} testID={testID} edges={['top', 'bottom']}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

export function RevealPrimaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.primary}
      testID={testID}>
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function RevealSecondaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.secondary}
      testID={testID}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTokens.color.pageBg },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  primary: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    minHeight: AppTokens.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  primaryLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondary: {
    minHeight: AppTokens.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryLabel: {
    color: AppTokens.color.muted,
    fontSize: 15,
    fontWeight: '500',
  },
});
