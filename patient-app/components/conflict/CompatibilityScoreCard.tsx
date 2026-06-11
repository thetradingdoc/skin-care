import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { scoreCardBg, overallColor } from '@/lib/conflict-helpers';
import type { VerdictOverall } from '@/lib/conflict-types';

type Props = {
  score: number;
  overall: VerdictOverall;
  title?: string;
  subtitle?: string;
};

export function CompatibilityScoreCard({ score, overall, title, subtitle }: Props) {
  const bg = scoreCardBg(overall);
  const accent = overallColor(overall);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      <View style={styles.row}>
        <View style={styles.scoreCol}>
          <Text style={[styles.score, { color: accent }]}>{Math.round(score)}</Text>
          <Text style={styles.scoreLabel}>/100</Text>
        </View>
        <View style={styles.copyCol}>
          <Text style={styles.compatLabel}>compatibility</Text>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreCol: { alignItems: 'center', minWidth: 72 },
  score: { fontSize: 48, fontWeight: '800', lineHeight: 52 },
  scoreLabel: { fontSize: 14, color: '#6B7280' },
  copyCol: { flex: 1, gap: 4 },
  compatLabel: { fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#4B5563', lineHeight: 20 },
});
