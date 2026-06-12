import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ProductInsight } from '@/lib/conflict-types';

type Props = {
  insight: ProductInsight;
};

function severityLabel(severity?: string) {
  if (severity === 'caution') return 'Caution';
  if (severity === 'watch') return 'Watch';
  return 'Insight';
}

export function ProductInsightCard({ insight }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Personal insight</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{severityLabel(insight.severity)}</Text>
        </View>
      </View>
      {insight.title ? <Text style={styles.title}>{insight.title}</Text> : null}
      {insight.message ? <Text style={styles.message}>{insight.message}</Text> : null}
      {insight.barrier_note ? <Text style={styles.meta}>{insight.barrier_note}</Text> : null}
      {insight.skin_note ? <Text style={styles.meta}>{insight.skin_note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#E6F1FB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  kicker: { fontSize: 11, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  badge: { backgroundColor: '#fff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#374151' },
  title: { fontSize: 15, fontWeight: '700', marginBottom: 6, color: '#111827' },
  message: { fontSize: 13, lineHeight: 19, color: '#374151' },
  meta: { fontSize: 11, color: '#6B7280', marginTop: 6 },
});
