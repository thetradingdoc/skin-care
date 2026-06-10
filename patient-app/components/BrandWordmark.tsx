import { useFonts } from 'expo-font';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TULIP_PATH } from '@/lib/tulip-path.js';

type Props = { height?: number; className?: string; style?: ViewStyle };

export function BrandWordmark({ height = 40, style }: Props) {
  const [loaded] = useFonts({
    BeVietnamProBoldItalic: require('@/assets/brand/fonts/BeVietnamPro-BoldItalic.ttf'),
    BeVietnamProBold: require('@/assets/brand/fonts/BeVietnamPro-Bold.ttf'),
  });

  const fontSize = height * 0.58;
  const markWidth = fontSize * 0.9;
  const markHeight = markWidth * (215 / 600);
  const slotWidth = fontSize * 0.62;

  if (!loaded) {
    return <View style={[{ height, marginBottom: 12 }, style]} />;
  }

  return (
    <View style={[styles.nativeRow, { marginBottom: 12 }, style]} accessibilityRole="image" accessibilityLabel="skin care">
      <Text
        style={{
          fontFamily: 'BeVietnamProBoldItalic',
          fontSize,
          lineHeight: fontSize,
          fontStyle: 'italic',
          fontWeight: '700',
          color: '#000000',
          marginRight: -fontSize * 0.02,
        }}>
        skin
      </Text>
      <View
        style={{
          width: slotWidth,
          height: fontSize,
          alignSelf: 'flex-start',
          marginTop: -fontSize * 0.48,
          marginHorizontal: -fontSize * 0.05,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}>
        <Svg width={markWidth} height={markHeight} viewBox="0 0 600 215">
          <Path d={TULIP_PATH} fill="#000000" />
        </Svg>
      </View>
      <Text
        style={{
          fontFamily: 'BeVietnamProBold',
          fontSize,
          lineHeight: fontSize,
          fontWeight: '700',
          color: '#000000',
          marginLeft: -fontSize * 0.02,
          letterSpacing: -fontSize * 0.03,
        }}>
        care
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nativeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
