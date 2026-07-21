/**
 * Touche tulip mark — exact path from tulip-mark.svg / lib/tulip-path.js.
 * Accepts a color prop for context (red on white, white on red hero).
 */
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { V4DesignTokens } from '@/constants/v4DesignTokens';
import { TULIP_PATH } from '@/lib/tulip-path.js';

type Props = {
  color?: string;
  width?: number;
  height?: number;
  style?: ViewStyle;
  testID?: string;
};

export function ToucheTulipMark({
  color = V4DesignTokens.color.red,
  width = 48,
  height,
  style,
  testID = 'touche-tulip-mark',
}: Props) {
  const h = height ?? width * (215 / 600);
  return (
    <View style={style} testID={testID} accessibilityRole="image" accessibilityLabel="touche tulip">
      <Svg width={width} height={h} viewBox="0 0 600 215">
        <Path d={TULIP_PATH} fill={color} />
      </Svg>
    </View>
  );
}
