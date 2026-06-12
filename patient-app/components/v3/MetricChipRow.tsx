import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

export type MetricChip = {
  label: string;
  value: string;
  color?: string;
  onPress?: () => void;
};

export function MetricChipRow({ chips }: { chips: MetricChip[] }) {
  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <Pressable
          key={chip.label}
          style={styles.chip}
          onPress={chip.onPress}
          disabled={!chip.onPress}
          accessibilityRole={chip.onPress ? 'button' : 'text'}>
          <Text style={[styles.value, chip.color ? { color: chip.color } : null]}>{chip.value}</Text>
          <Text style={styles.label}>{chip.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  chip: {
    flex: 1,
    backgroundColor: AppTokens.color.cream,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTokens.color.line,
  },
  value: { fontSize: 17, fontWeight: '700', color: AppTokens.color.ink },
  label: { fontSize: 10, color: AppTokens.color.muted, marginTop: 2 },
});
