import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Variant = 'watch' | 'routine';

type Props = {
  variant: Variant;
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress: () => void;
};

export function JourneyModeCard({ variant, title, subtitle, selected, onPress }: Props) {
  const isWatch = variant === 'watch';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        selected && (isWatch ? styles.cardWatch : styles.cardRoutine),
      ]}
      accessibilityRole="button">
      <View style={[styles.icon, isWatch ? styles.iconWatch : styles.iconRoutine]}>
        <MaterialIcons
          name={isWatch ? 'visibility' : 'water-drop'}
          size={22}
          color={isWatch ? AppTokens.color.watchAmberText : AppTokens.color.routineGreenText}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={AppTokens.color.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AppTokens.color.card,
  },
  cardWatch: {
    borderColor: '#BA7517',
    backgroundColor: AppTokens.color.watchAmber,
  },
  cardRoutine: {
    borderColor: AppTokens.color.barrierGreat,
    backgroundColor: AppTokens.color.routineGreen,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWatch: { backgroundColor: AppTokens.color.watchAmber },
  iconRoutine: { backgroundColor: AppTokens.color.routineGreen },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 3 },
  sub: { fontSize: 12, color: AppTokens.color.muted, lineHeight: 17 },
});
