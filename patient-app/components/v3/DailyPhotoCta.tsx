import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  label?: string;
  streakDays?: number;
  verdictLabel?: string;
  verdictColor?: string;
  onPress: () => void;
};

export function DailyPhotoCta({
  label = "Take today's photo",
  streakDays,
  verdictLabel,
  verdictColor,
  onPress,
}: Props) {
  return (
    <Pressable style={styles.cta} onPress={onPress} accessibilityRole="button">
      <MaterialIcons name="photo-camera" size={22} color="rgba(255,255,255,0.6)" />
      <Text style={styles.text}>{label}</Text>
      {streakDays && streakDays > 0 ? (
        <View style={styles.streak}>
          <Text style={styles.streakText}>{streakDays} day streak</Text>
        </View>
      ) : null}
      {verdictLabel ? (
        <View style={[styles.verdict, verdictColor ? { backgroundColor: verdictColor } : null]}>
          <Text style={styles.verdictText}>{verdictLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    marginHorizontal: 14,
    marginVertical: 6,
    borderRadius: 14,
    backgroundColor: AppTokens.color.fabBg,
    aspectRatio: 16 / 7,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
    minHeight: AppTokens.minTap,
  },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
  streak: {
    position: 'absolute',
    top: 8,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  streakText: { color: '#fff', fontSize: 10 },
  verdict: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(163,45,45,0.8)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  verdictText: { color: '#fff', fontSize: 10, fontWeight: '600' },
});
