import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  title?: string;
  body?: string;
};

export function EvidenceSnippetCard({ title, body }: Props) {
  if (!title && !body) return null;
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  title: { fontSize: 14, fontWeight: '700', color: '#111' },
  body: { fontSize: 13, color: '#4B5563', lineHeight: 20 },
});
