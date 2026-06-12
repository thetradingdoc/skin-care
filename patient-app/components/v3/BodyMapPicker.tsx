import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

import { AppTokens } from '@/constants/appTokens';
import type { BodyRegion } from '@/lib/spot-store';

type Props = {
  selected?: BodyRegion;
  onSelect: (region: BodyRegion) => void;
};

const REGIONS: { id: BodyRegion; label: string; cx: number; cy: number; r: number }[] = [
  { id: 'head', label: 'Head', cx: 30, cy: 10, r: 10 },
  { id: 'neck', label: 'Neck', cx: 30, cy: 22, r: 6 },
  { id: 'chest', label: 'Chest', cx: 30, cy: 35, r: 10 },
  { id: 'arm', label: 'Arm', cx: 12, cy: 33, r: 8 },
  { id: 'leg', label: 'Leg', cx: 23, cy: 63, r: 10 },
];

export function BodyMapPicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Where on your body?</Text>
      <Svg width={60} height={80} viewBox="0 0 60 80">
        <Ellipse cx="30" cy="10" rx="9" ry="10" fill={AppTokens.color.line} />
        <Rect x="18" y="22" width="24" height="26" rx="4" fill={AppTokens.color.line} />
        <Rect x="7" y="22" width="10" height="22" rx="4" fill={AppTokens.color.line} />
        <Rect x="43" y="22" width="10" height="22" rx="4" fill={AppTokens.color.line} />
        <Rect x="18" y="50" width="10" height="26" rx="4" fill={AppTokens.color.line} />
        <Rect x="32" y="50" width="10" height="26" rx="4" fill={AppTokens.color.line} />
        {selected ? (
          <Circle
            cx={REGIONS.find((r) => r.id === selected)?.cx ?? 30}
            cy={REGIONS.find((r) => r.id === selected)?.cy ?? 8}
            r="5"
            fill={AppTokens.color.barrierOk}
            opacity={0.9}
          />
        ) : null}
      </Svg>
      <View style={styles.chips}>
        {REGIONS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onSelect(r.id)}
            style={[styles.chip, selected === r.id && styles.chipOn]}
            accessibilityRole="button">
            <Text style={[styles.chipText, selected === r.id && styles.chipTextOn]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>
      {selected ? (
        <Text style={styles.hint}>Tap your body to mark the spot</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
  },
  label: { fontSize: 11, color: AppTokens.color.muted, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    backgroundColor: AppTokens.color.card,
  },
  chipOn: {
    borderColor: AppTokens.color.barrierGreat,
    backgroundColor: AppTokens.color.routineGreen,
  },
  chipText: { fontSize: 11, color: AppTokens.color.muted },
  chipTextOn: { color: AppTokens.color.routineGreenText, fontWeight: '600' },
  hint: { fontSize: 10, color: AppTokens.color.watchAmberText, fontWeight: '600', marginTop: 6 },
});
