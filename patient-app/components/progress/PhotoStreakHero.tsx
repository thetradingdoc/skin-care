import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppFontFamilies } from '@/components/ui/AppFontsProvider';
import { AppTokens } from '@/constants/appTokens';

type Props = {
  onTakePhoto: () => void;
};

function Polaroid({ label, rotate }: { label: string; rotate: string }) {
  return (
    <View style={[styles.polaroid, { transform: [{ rotate }] }]}>
      <View style={styles.polaroidPhoto} />
      <Text style={styles.polaroidLabel}>{label}</Text>
    </View>
  );
}

export function PhotoStreakHero({ onTakePhoto }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Start your photo streak</Text>
      <Text style={styles.body}>
        Take a daily progress photo on Home or log a spot on Track to build your progress story.
      </Text>
      <View style={styles.polaroidRow}>
        <Polaroid label="Day 1" rotate="-8deg" />
        <Polaroid label="Day 3" rotate="4deg" />
        <Polaroid label="Today ✨" rotate="-2deg" />
      </View>
      <Pressable style={styles.cta} onPress={onTakePhoto} accessibilityRole="button">
        <AppIcon name="camera" size={18} color="#fff" />
        <Text style={styles.ctaText}>Take today&apos;s photo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTokens.color.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTokens.color.line,
    padding: 18,
    marginBottom: 12,
    ...AppTokens.shadow.card,
  },
  title: {
    fontFamily: AppFontFamilies.display,
    fontSize: 22,
    color: AppTokens.color.ink,
    marginBottom: 6,
  },
  body: {
    fontFamily: AppFontFamilies.body,
    fontSize: 13,
    color: AppTokens.color.muted,
    lineHeight: 20,
    marginBottom: 14,
  },
  polaroidRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 4,
    marginBottom: 16,
    minHeight: 72,
  },
  polaroid: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 6,
    paddingBottom: 10,
    width: 72,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  polaroidPhoto: {
    height: 48,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginBottom: 4,
  },
  polaroidLabel: {
    fontSize: 9,
    color: AppTokens.color.muted,
    textAlign: 'center',
    fontFamily: AppFontFamilies.bodyMedium,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppTokens.color.fabBg,
    borderRadius: 12,
    paddingVertical: 14,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: AppFontFamilies.bodySemiBold,
  },
});
