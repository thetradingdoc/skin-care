import React, { Children, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppTokens } from '@/constants/appTokens';

/**
 * Dumb chrome for second-tier screens — no shared state-machine logic.
 * Last child is treated as a sticky footer (primary CTA); everything above scrolls.
 * Optical (14+ fields) and imaging (Findings/Conclusion) need this — the old
 * space-between layout had no ScrollView and clipped large templates.
 */
export function SecondTierChrome({
  testID,
  children,
}: {
  testID: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  const footer = items.length > 1 ? items[items.length - 1] : null;
  const main = items.length > 1 ? items.slice(0, -1) : items;

  return (
    <SafeAreaView style={styles.root} testID={testID} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          testID={`${testID}-scroll`}>
          {main}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

export function TierPrimary({
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
      style={styles.primary}
      onPress={onPress}
      testID={testID}>
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function TierSecondary({
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
      style={styles.secondary}
      onPress={onPress}
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
    paddingTop: 40,
    paddingBottom: 24,
  },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 16, flexGrow: 1 },
  footer: { marginTop: 8 },
  primary: {
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: AppTokens.radius.md,
    minHeight: AppTokens.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    minHeight: AppTokens.minTap,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: AppTokens.color.muted, fontSize: 15, fontWeight: '500' },
});
