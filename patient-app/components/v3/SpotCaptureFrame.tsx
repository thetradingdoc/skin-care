import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  onPress?: () => void;
  hint?: string;
};

export function SpotCaptureFrame({ onPress, hint = 'Tap anywhere to capture' }: Props) {
  return (
    <Pressable style={styles.frame} onPress={onPress} accessibilityRole="button">
      <View style={styles.ring}>
        <MaterialIcons name="photo-camera" size={28} color="rgba(255,255,255,0.4)" />
      </View>
      <Text style={styles.hint}>{hint}</Text>
      <View style={styles.guide}>
        <Text style={styles.guideText}>Hold still</Text>
      </View>
      <View style={styles.sizeRef}>
        <View style={styles.coin} />
        <Text style={styles.sizeLabel}>Put a coin next to it for size</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    backgroundColor: AppTokens.color.photoBg,
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
  guide: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  guideText: { color: '#fff', fontSize: 10 },
  sizeRef: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: AppTokens.color.barrierOk,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  sizeLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
});
