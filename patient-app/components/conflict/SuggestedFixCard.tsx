import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';

type Props = {
  title?: string;
  message?: string;
  suggestedSplit?: { am?: string[]; pm?: string[] } | null;
};

export function SuggestedFixCard({ title = 'The fix', message, suggestedSplit }: Props) {
  const am = suggestedSplit?.am?.filter(Boolean) || [];
  const pm = suggestedSplit?.pm?.filter(Boolean) || [];

  return (
    <View style={styles.card}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {am.length || pm.length ? (
        <View style={styles.split}>
          {am.length ? (
            <View style={styles.splitCol}>
              <Text style={styles.splitLabel}>AM</Text>
              <Text style={styles.splitBody}>{am.join(', ')}</Text>
            </View>
          ) : null}
          {pm.length ? (
            <View style={styles.splitCol}>
              <Text style={styles.splitLabel}>PM</Text>
              <Text style={styles.splitBody}>{pm.join(', ')}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ConflictTokens.cardGreen,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ConflictTokens.barrierGreat,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    marginBottom: 8,
    overflow: 'hidden',
  },
  title: { fontSize: 16, fontWeight: '700', color: ConflictTokens.cardGreenText, marginBottom: 6 },
  message: { fontSize: 14, color: '#374151', lineHeight: 20 },
  split: { flexDirection: 'row', gap: 12, marginTop: 12 },
  splitCol: { flex: 1 },
  splitLabel: { fontSize: 11, fontWeight: '700', color: ConflictTokens.cardGreenText, marginBottom: 4 },
  splitBody: { fontSize: 13, color: '#374151', lineHeight: 18 },
});
