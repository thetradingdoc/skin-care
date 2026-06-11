import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { gridCellColor } from '@/lib/conflict-helpers';
import type { VerdictHistoryDay } from '@/lib/conflict-types';

type Props = {
  days: VerdictHistoryDay[];
};

export function BarrierGrid8({ days }: Props) {
  const cells = days.slice(-8);
  while (cells.length < 8) {
    cells.unshift({ date: '', barrier_friction_index: null, overall: null });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Barrier health — last 8 days</Text>
      <View style={styles.grid}>
        {cells.map((d, i) => (
          <View key={d.date || `empty-${i}`} style={styles.cellWrap}>
            <View style={[styles.cell, { backgroundColor: gridCellColor(d.barrier_friction_index) }]}>
              {d.barrier_friction_index != null ? (
                <Text style={styles.bfi}>{Math.round(d.barrier_friction_index)}</Text>
              ) : null}
            </View>
            {d.date ? (
              <Text style={styles.day}>{d.date.slice(8)}</Text>
            ) : (
              <Text style={styles.day}>—</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  grid: { flexDirection: 'row', gap: 6 },
  cellWrap: { flex: 1, alignItems: 'center', gap: 4 },
  cell: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    maxWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bfi: { fontSize: 11, fontWeight: '800', color: '#fff' },
  day: { fontSize: 10, color: '#9CA3AF' },
});
