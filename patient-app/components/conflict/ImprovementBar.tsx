import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';

type Props = {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  positiveIsGood?: boolean;
};

export function ImprovementBar({ label, value, max = 100, unit = '%', positiveIsGood = true }: Props) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / max) * 100));
  const good = positiveIsGood ? value >= 0 : value <= 0;
  const color = good ? ConflictTokens.barrierGreat : ConflictTokens.barrierWarn;
  const sign = value > 0 ? '+' : '';

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color }]}>
          {sign}
          {Math.round(value)}
          {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  value: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
