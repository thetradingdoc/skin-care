import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';
import type { Spot } from '@/lib/spot-store';
import { spotDayCount } from '@/lib/spot-store';

type Props = {
  spot: Spot;
  onPress: () => void;
  statusLabel?: string;
};

export function SpotRowCard({ spot, onPress, statusLabel }: Props) {
  const days = spotDayCount(spot);
  const photoCount = spot.photos.length;
  const status = statusLabel ?? (days >= 14 ? 'size stable' : days >= 7 ? 'worth watching' : 'still gathering');
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.icon}>
        <MaterialIcons name="visibility" size={15} color={AppTokens.color.watchAmberText} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{spot.label}</Text>
        <Text style={styles.sub}>
          {days} days · {status} · {photoCount} photo{photoCount === 1 ? '' : 's'}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={18} color={AppTokens.color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 12,
    backgroundColor: AppTokens.color.card,
    minHeight: AppTokens.minTap,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: AppTokens.color.watchAmber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: 12, fontWeight: '600', color: AppTokens.color.ink },
  sub: { fontSize: 10, color: AppTokens.color.muted, marginTop: 2 },
});
