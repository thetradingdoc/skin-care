import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';
import type { ConflictHit, ContraindicationAlert } from '@/lib/conflict-types';

function severityPill(severity?: string) {
  const s = String(severity || 'moderate').toLowerCase();
  if (s === 'critical' || s === 'high') return { bg: ConflictTokens.cardRed, text: ConflictTokens.cardRedText, label: 'High' };
  if (s === 'moderate' || s === 'medium') return { bg: ConflictTokens.cardAmber, text: ConflictTokens.cardAmberText, label: 'Moderate' };
  return { bg: ConflictTokens.cardGreen, text: ConflictTokens.cardGreenText, label: 'Low' };
}

export function ConflictCard({ conflict }: { conflict: ConflictHit }) {
  const pill = severityPill(conflict.severity || conflict.verdict);
  const title =
    conflict.ingredient_a && conflict.ingredient_b
      ? `${conflict.ingredient_a} + ${conflict.ingredient_b}`
      : conflict.ingredient_a || 'Ingredient conflict';

  return (
    <View style={[styles.card, { backgroundColor: pill.bg }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>⚠️</Text>
        <View style={styles.body}>
          <Text style={[styles.title, { color: pill.text }]}>{title}</Text>
          <Text style={styles.sub}>{conflict.notes || 'These actives may not layer well together.'}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
          <Text style={[styles.pillText, { color: pill.text }]}>{pill.label}</Text>
        </View>
      </View>
    </View>
  );
}

export function ContraindicationCard({ alert }: { alert: ContraindicationAlert }) {
  const pill = severityPill(alert.severity);
  return (
    <View style={[styles.card, { backgroundColor: pill.bg }]}>
      <View style={styles.row}>
        <Text style={styles.icon}>🧬</Text>
        <View style={styles.body}>
          <Text style={[styles.title, { color: pill.text }]}>{alert.title || 'Profile alert'}</Text>
          <Text style={styles.sub}>{alert.message || 'Not ideal for your skin profile.'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 14, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { fontSize: 18, marginTop: 2 },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '700' },
});
