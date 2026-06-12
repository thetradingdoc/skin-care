import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export function PrimaryFab({ label, icon = 'add', onPress }: Props) {
  return (
    <Pressable style={styles.fab} onPress={onPress} accessibilityRole="button">
      <MaterialIcons name={icon} size={18} color="#fff" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginVertical: 4,
    paddingVertical: 13,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 16,
    minHeight: AppTokens.minTap,
  },
  label: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
