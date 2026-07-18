import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  metrics: {
    redness_pct?: number;
    breakouts_pct?: number;
    texture_pct?: number;
    hydration_pct?: number;
  };
};

const METRIC_META: Array<{
  key: keyof Props['metrics'];
  label: string;
  color: string;
}> = [
  { key: 'redness_pct', label: 'Redness', color: '#E24B4A' },
  { key: 'breakouts_pct', label: 'Breakouts', color: '#EF9F27' },
  { key: 'texture_pct', label: 'Texture', color: '#1D9E75' },
  { key: 'hydration_pct', label: 'Hydration', color: '#314DB6' },
];

function formatImprovement(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

/**
 * Shows journal-derived week-over-week % only when a value is present.
 * No fabricated sparklines — charts stay hidden until a real series exists.
 */
export function SkinMetricSparkCards({ metrics }: Props) {
  const cards = METRIC_META.filter((m) => typeof metrics[m.key] === 'number').map((m) => ({
    ...m,
    value: metrics[m.key] as number,
  }));

  if (!cards.length) {
    return (
      <Text style={styles.empty} accessibilityRole="text">
        Not enough journal days yet for improvement trends.
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {cards.map((m) => (
        <View
          key={m.key}
          style={styles.card}
          accessibilityLabel={`${m.label} ${formatImprovement(m.value)}`}>
          <Text style={[styles.value, { color: m.color }]}>{formatImprovement(m.value)}</Text>
          <Text style={styles.label}>{m.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  card: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 10,
    alignItems: 'center',
    minHeight: 64,
  },
  value: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  label: { fontSize: 10, color: AppTokens.color.muted },
  empty: {
    fontFamily: AppTokens.font.body,
    fontSize: 14,
    color: AppTokens.color.muted,
    marginBottom: 8,
    lineHeight: 20,
  },
});
