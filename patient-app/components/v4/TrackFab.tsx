/**
 * Track FAB — solid #E31919 circle, 4px white ring, white center dot.
 * No gradient, no secondary color.
 */
import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { V4DesignTokens } from '@/constants/v4DesignTokens';

type Props = {
  size?: number;
  onPress?: () => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
};

export function TrackFab({
  size = 56,
  onPress,
  style,
  testID = 'track-fab',
  accessibilityLabel = 'Track',
}: Props) {
  const ring = V4DesignTokens.fab.ringWidth;
  const outer = size;
  const inner = size - ring * 2;
  const dot = V4DesignTokens.fab.centerDot;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { width: outer, height: outer, borderRadius: outer / 2 }, style]}>
      <View
        style={[
          styles.ring,
          {
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: ring,
            backgroundColor: V4DesignTokens.color.red,
          },
        ]}>
        <View
          style={[
            styles.inner,
            {
              width: inner,
              height: inner,
              borderRadius: inner / 2,
              backgroundColor: V4DesignTokens.color.red,
            },
          ]}>
          <View
            style={[
              styles.dot,
              {
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: V4DesignTokens.color.white,
              },
            ]}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderColor: V4DesignTokens.color.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {},
});
