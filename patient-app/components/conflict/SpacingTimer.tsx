import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';

type Props = {
  spacingHours: number;
  label?: string;
};

function formatRemaining(ms: number) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SpacingTimer({ spacingHours, label }: Props) {
  const [remaining, setRemaining] = useState(spacingHours * 3600000);
  const endAt = Date.now() + spacingHours * 3600000;

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endAt - Date.now()));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [endAt, spacingHours]);

  if (spacingHours <= 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>⏱ Spacing timer</Text>
      <Text style={styles.body}>
        {label || `Wait before layering the next active.`}
      </Text>
      <Text style={styles.timer}>{formatRemaining(remaining)}</Text>
      <Text style={styles.hint}>Recommended gap: {spacingHours}h</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ConflictTokens.cardAmber,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: '700', color: ConflictTokens.cardAmberText, marginBottom: 4 },
  body: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  timer: { fontSize: 28, fontWeight: '800', color: ConflictTokens.cardAmberText, marginTop: 8 },
  hint: { fontSize: 12, color: '#6B7280', marginTop: 4 },
});
