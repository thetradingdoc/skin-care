import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  title: string;
  days: number;
  note: string;
  status?: 'stable' | 'watch' | 'alert';
  dayOnePct?: number;
  todayPct?: number;
  dayOneEndLabel?: string;
  todayEndLabel?: string;
};

export function GrowthSummaryCard({
  title,
  days,
  note,
  status = 'stable',
  dayOnePct = 55,
  todayPct = 52,
  dayOneEndLabel = 'larger',
  todayEndLabel = 'similar',
}: Props) {
  const dotColor =
    status === 'alert' ? AppTokens.color.barrierWarn :
    status === 'watch' ? AppTokens.color.barrierOk :
    AppTokens.color.barrierGreat;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.time}>{days} days</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Day 1</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${dayOnePct}%`, backgroundColor: AppTokens.color.barrierWarn }]} />
        </View>
        <Text style={styles.barEnd}>{dayOneEndLabel}</Text>
      </View>
      <View style={styles.barRow}>
        <Text style={styles.barLabel}>Today</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${todayPct}%`, backgroundColor: AppTokens.color.barrierOk }]} />
        </View>
        <Text style={styles.barEnd}>{todayEndLabel}</Text>
      </View>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 14,
    backgroundColor: AppTokens.color.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: AppTokens.color.ink },
  time: { fontSize: 11, color: AppTokens.color.muted },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  barLabel: { width: 40, fontSize: 10, color: AppTokens.color.muted },
  track: { flex: 1, height: 6, backgroundColor: AppTokens.color.cream, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  barEnd: { fontSize: 10, color: AppTokens.color.muted },
  note: {
    fontSize: 11,
    color: AppTokens.color.muted,
    lineHeight: 16,
    borderTopWidth: 1,
    borderTopColor: AppTokens.color.line,
    paddingTop: 6,
    marginTop: 6,
  },
});
