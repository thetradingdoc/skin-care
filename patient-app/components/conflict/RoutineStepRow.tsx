import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';

export type StepState = 'done' | 'warn' | 'todo';

type Props = {
  label: string;
  sub?: string;
  state: StepState;
};

function iconFor(state: StepState) {
  if (state === 'done') return '✓';
  if (state === 'warn') return '!';
  return '○';
}

function colorsFor(state: StepState) {
  if (state === 'done') return { bg: ConflictTokens.cardGreen, border: ConflictTokens.barrierGreat, text: ConflictTokens.cardGreenText };
  if (state === 'warn') return { bg: ConflictTokens.cardAmber, border: ConflictTokens.barrierOk, text: ConflictTokens.cardAmberText };
  return { bg: '#F9FAFB', border: '#D1D5DB', text: '#6B7280' };
}

export function RoutineStepRow({ label, sub, state }: Props) {
  const colors = colorsFor(state);

  return (
    <View style={[styles.row, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={[styles.icon, { borderColor: colors.border }]}>
        <Text style={[styles.iconText, { color: colors.text }]}>{iconFor(state)}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  iconText: { fontSize: 14, fontWeight: '800' },
  copy: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600', color: '#111' },
  sub: { fontSize: 13, color: '#6B7280' },
});
