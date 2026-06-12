import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type IconVariant = 'primary' | 'amber' | 'blue' | 'green';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  variant?: IconVariant;
  primary?: boolean;
  onPress: () => void;
};

export function AtmActionButton({
  title,
  subtitle,
  icon,
  variant = 'amber',
  primary,
  onPress,
}: Props) {
  const iconBg =
    primary ? 'rgba(255,255,255,0.15)' :
    variant === 'blue' ? AppTokens.color.infoBlue :
    variant === 'green' ? AppTokens.color.routineGreen :
    AppTokens.color.watchAmber;
  const iconColor =
    primary ? '#fff' :
    variant === 'blue' ? AppTokens.color.infoBlueText :
    variant === 'green' ? AppTokens.color.routineGreenText :
    AppTokens.color.watchAmberText;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, primary && styles.btnPrimary]}
      accessibilityRole="button">
      <View style={[styles.icon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, primary && styles.titlePrimary]}>{title}</Text>
        <Text style={[styles.sub, primary && styles.subPrimary]}>{subtitle}</Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={20}
        color={primary ? 'rgba(255,255,255,0.6)' : AppTokens.color.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: AppTokens.color.card,
    minHeight: AppTokens.minTap,
  },
  btnPrimary: {
    backgroundColor: AppTokens.color.fabBg,
    borderColor: AppTokens.color.fabBg,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: AppTokens.color.ink, marginBottom: 2 },
  titlePrimary: { color: '#fff' },
  sub: { fontSize: 12, color: AppTokens.color.muted, lineHeight: 16 },
  subPrimary: { color: 'rgba(255,255,255,0.7)' },
});
