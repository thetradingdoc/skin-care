import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  days?: number;
  body?: string;
  onFindDoctor?: () => void;
};

export function DoctorAlertCard({ days, body, onFindDoctor }: Props) {
  const defaultBody =
    days != null && days >= 7
      ? `You've been tracking this for ${days} days. If it's changed in colour, shape, or size — or if it itches, bleeds, or hurts — please see a dermatologist. Show them your photos.`
      : "If it has changed in colour, shape, or size — or if it itches, bleeds, or hurts — please see a dermatologist. Show them your photos.";

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <MaterialIcons name="warning" size={16} color={AppTokens.color.cardRedText} />
        </View>
        <Text style={styles.title}>Worth showing a doctor</Text>
      </View>
      <Text style={styles.body}>{body ?? defaultBody}</Text>
      {onFindDoctor ? (
        <Pressable style={styles.btn} onPress={onFindDoctor} accessibilityRole="button">
          <Text style={styles.btnText}>Find a dermatologist</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 12,
    backgroundColor: AppTokens.color.cardRed,
    borderRadius: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(163,45,45,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 13, fontWeight: '600', color: AppTokens.color.cardRedText },
  body: { fontSize: 12, color: '#A32D2D', lineHeight: 17 },
  btn: {
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: AppTokens.color.cardRedText,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: AppTokens.minTap,
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
