import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ConflictTokens } from '@/constants/conflictTokens';
import { bfiColor, barrierLabel } from '@/lib/conflict-helpers';

type Props = {
  bfi: number;
  subtitle?: string;
  size?: number;
};

/** Static ring — Reanimated + SVG animatedProps was aborting cold start (SIGABRT / RCTFatal). */
export function BarrierScoreRing({ bfi, subtitle, size = 180 }: Props) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clamped = Math.min(Math.max(bfi, 0), 100) / 100;
  const color = bfiColor(bfi);
  const strokeDashoffset = circumference - clamped * circumference;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Circle
          stroke="#E5E7EB"
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.labelContainer]}>
        <Text style={styles.score}>{Math.round(bfi)}</Text>
        <Text style={styles.scoreSub}>barrier</Text>
      </View>
      <Text style={[styles.label, { color }]}>{barrierLabel(bfi)}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 8 },
  labelContainer: { justifyContent: 'center', alignItems: 'center' },
  score: { fontSize: 36, fontWeight: '800', color: ConflictTokens.fabBg },
  scoreSub: { fontSize: 12, color: '#6B7280', letterSpacing: 1, textTransform: 'uppercase' },
  label: { marginTop: 12, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 24 },
});
