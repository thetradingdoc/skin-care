import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { productPillColors, productPillLabel } from '@/lib/conflict-helpers';
import type { ProductStatus } from '@/lib/conflict-types';

type Props = ProductStatus & {
  onPress?: () => void;
};

function statusIcon(status: ProductStatus['status']): keyof typeof MaterialIcons.glyphMap {
  if (status === 'conflict') return 'warning';
  if (status === 'watch') return 'visibility';
  if (status === 'safe') return 'check-circle';
  return 'help-outline';
}

export function ShelfProductRow({ product_name, status, usage_time, note, onPress }: Props) {
  const pill = productPillColors(status);
  const usage = usage_time ? String(usage_time).toUpperCase() : '';
  const subcopy = note ? `${usage}${usage ? ' · ' : ''}${note}` : usage;

  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!onPress}>
      <MaterialIcons name={statusIcon(status)} size={20} color={pill.text} style={styles.icon} />
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {product_name || 'Product'}
        </Text>
        {subcopy ? <Text style={styles.usage}>{subcopy}</Text> : null}
      </View>
      <View style={[styles.pill, { backgroundColor: pill.bg }]}>
        <Text style={[styles.pillText, { color: pill.text }]}>{productPillLabel(status)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  icon: { width: 22 },
  copy: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: '#111' },
  usage: { fontSize: 12, color: '#6B7280' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
});
