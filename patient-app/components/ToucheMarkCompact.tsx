import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { TULIP_PATH } from '@/lib/tulip-path.js';

/** @deprecated Use V4DesignTokens.color.red (#E31919). Kept as alias during migration. */
export const TOUCHE_MARK_ORANGE = V4DesignTokens.color.red;
export const TOUCHE_MARK_RED = V4DesignTokens.color.red;

type Props = {
  /** Overall row height; keep compact so shutter/ambient stay dominant. */
  height?: number;
  style?: ViewStyle;
  /** Mark + wordmark color (default brand red). */
  color?: string;
};

/**
 * Compact skiñcare mark — tulip path from tulip-mark.svg + brand label.
 * Brand color is v4.1 red (E31919); legacy brand orange retired.
 */
export function ToucheMarkCompact({
  height = 22,
  style,
  color = V4DesignTokens.color.red,
}: Props) {
  const fontSize = height * 0.72;
  const markWidth = fontSize * 0.95;
  const markHeight = markWidth * (215 / 600);

  return (
    <View
      style={[styles.row, { height }, style]}
      accessibilityRole="image"
      accessibilityLabel="skiñcare"
      testID="touche-mark-compact">
      <Svg width={markWidth} height={markHeight} viewBox="0 0 600 215" style={styles.tulip}>
        <Path d={TULIP_PATH} fill={color} />
      </Svg>
      <Text style={[styles.word, { fontSize, lineHeight: fontSize, color }]}>touche</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tulip: {
    marginTop: 1,
  },
  word: {
    fontFamily: V4DesignTokens.font.bodyBold,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
