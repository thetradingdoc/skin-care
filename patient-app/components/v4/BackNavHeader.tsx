/**
 * Back-nav header — chevron + label, reusable across non-root screens.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { V4DesignTokens } from '@/constants/v4DesignTokens';

type Props = {
  label?: string;
  onBack?: () => void;
  style?: ViewStyle;
  testID?: string;
};

export function BackNavHeader({
  label = 'Back',
  onBack,
  style,
  testID = 'back-nav-header',
}: Props) {
  const router = useRouter();
  const handle = () => {
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
  };

  return (
    <Pressable
      onPress={handle}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.row, style]}>
      <AppIcon name="chevron-left" size={22} color={V4DesignTokens.color.black} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.spacer} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingVertical: 4,
  },
  label: {
    fontFamily: V4DesignTokens.font.bodyMedium,
    fontSize: 16,
    color: V4DesignTokens.color.black,
  },
  spacer: { flex: 1 },
});
