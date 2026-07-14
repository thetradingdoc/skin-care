import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TULIP_PATH } from '@/lib/tulip-path.js';

/** Live touche brand orange (not skin‧care lockup). */
export const TOUCHE_MARK_ORANGE = '#F7591F';

type Props = {
  /** Overall row height; keep compact so shutter/ambient stay dominant. */
  height?: number;
  style?: ViewStyle;
};

/**
 * TOUCH-009 — Compact real touche mark for Check / bottle / spot chrome.
 * Tulip + "touche" in brand orange. Do not use BrandWordmark (skin‧care) here.
 */
export function ToucheMarkCompact({ height = 22, style }: Props) {
  const fontSize = height * 0.72;
  const markWidth = fontSize * 0.95;
  const markHeight = markWidth * (215 / 600);

  return (
    <View
      style={[styles.row, { height }, style]}
      accessibilityRole="image"
      accessibilityLabel="touche">
      <Svg width={markWidth} height={markHeight} viewBox="0 0 600 215" style={styles.tulip}>
        <Path d={TULIP_PATH} fill={TOUCHE_MARK_ORANGE} />
      </Svg>
      <Text style={[styles.word, { fontSize, lineHeight: fontSize }]}>touche</Text>
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
    fontFamily: 'System',
    fontWeight: '700',
    color: TOUCHE_MARK_ORANGE,
    letterSpacing: -0.3,
  },
});
