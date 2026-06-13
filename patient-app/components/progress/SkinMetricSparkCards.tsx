import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { AppTokens } from '@/constants/appTokens';

type Metric = {
  key: string;
  label: string;
  value: number;
  color: string;
  points: number[];
};

type Props = {
  metrics: {
    redness_pct?: number;
    breakouts_pct?: number;
    texture_pct?: number;
    hydration_pct?: number;
  };
};

function sparkPoints(values: number[]): string {
  const w = 48;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
}

function buildMetrics(metrics: Props['metrics']): Metric[] {
  return [
    {
      key: 'redness',
      label: 'Redness',
      value: metrics.redness_pct ?? 0,
      color: '#E24B4A',
      points: [12, 10, 8, 7, 5, 4, 3, 2],
    },
    {
      key: 'breakouts',
      label: 'Breakouts',
      value: metrics.breakouts_pct ?? 0,
      color: '#EF9F27',
      points: [14, 12, 11, 9, 7, 6, 4, 3],
    },
    {
      key: 'texture',
      label: 'Texture',
      value: metrics.texture_pct ?? 0,
      color: '#1D9E75',
      points: [2, 3, 5, 6, 8, 10, 12, 14],
    },
    {
      key: 'hydration',
      label: 'Hydration',
      value: metrics.hydration_pct ?? 0,
      color: '#314DB6',
      points: [3, 4, 6, 8, 10, 11, 13, 15],
    },
  ];
}

function formatImprovement(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${Math.round(value)}%`;
}

export function SkinMetricSparkCards({ metrics }: Props) {
  const cards = buildMetrics(metrics);
  return (
    <View style={styles.row}>
      {cards.map((m) => (
        <View key={m.key} style={styles.card} accessibilityLabel={`${m.label} ${formatImprovement(m.value)}`}>
          <Text style={[styles.value, { color: m.color }]}>{formatImprovement(m.value)}</Text>
          <Text style={styles.label}>{m.label}</Text>
          <Svg width={48} height={20} style={styles.spark} testID="metric-sparkline">
            <Polyline
              points={sparkPoints(m.points)}
              fill="none"
              stroke={m.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  card: {
    flex: 1,
    backgroundColor: AppTokens.color.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 10,
    alignItems: 'center',
    minHeight: 88,
  },
  value: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  label: { fontSize: 10, color: AppTokens.color.muted, marginBottom: 6 },
  spark: { marginTop: 'auto' },
});
