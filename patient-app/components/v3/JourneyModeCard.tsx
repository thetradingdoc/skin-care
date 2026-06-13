import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { AppTokens } from '@/constants/appTokens';

type Variant = 'watch' | 'routine' | 'spot';

type Props = {
  variant: Variant;
  title: string;
  subtitle: string;
  selected?: boolean;
  onPress: () => void;
};

const VARIANT_ICON: Record<Variant, AppIconName> = {
  watch: 'book',
  routine: 'droplet',
  spot: 'eye',
};

export function JourneyModeCard({ variant, title, subtitle, selected, onPress }: Props) {
  const isWatch = variant === 'watch';
  const isSpot = variant === 'spot';
  const selectedStyle = isWatch ? styles.cardWatch : isSpot ? styles.cardSpot : styles.cardRoutine;
  const iconStyle = isWatch ? styles.iconWatch : isSpot ? styles.iconSpot : styles.iconRoutine;
  const iconColor = isWatch
    ? AppTokens.color.brandBlue
    : isSpot
      ? AppTokens.color.watchAmberText
      : AppTokens.color.routineGreenText;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && selectedStyle]}
      accessibilityRole="button">
      <View style={[styles.icon, iconStyle]}>
        <AppIcon name={VARIANT_ICON[variant]} size={22} color={iconColor} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <AppIcon name="chevron-right" size={20} color={AppTokens.color.muted} />
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
    borderColor: AppTokens.color.brandBlue,
    backgroundColor: '#EEF1FB',
  },
  cardSpot: {
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
  iconWatch: { backgroundColor: '#EEF1FB' },
  iconSpot: { backgroundColor: AppTokens.color.watchAmber },
  iconRoutine: { backgroundColor: AppTokens.color.routineGreen },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 3 },
  sub: { fontSize: 12, color: AppTokens.color.muted, lineHeight: 17 },
});
