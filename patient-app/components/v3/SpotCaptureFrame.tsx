import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTokens } from '@/constants/appTokens';

type Props = {
  onPress?: () => void;
  hint?: string;
};

/** TOUCH-062 — soft-ring location guide only (no live diagnostic labels). */
export function SpotCaptureFrame({ onPress, hint = 'Tap to capture' }: Props) {
  return (
    <Pressable
      style={styles.frame}
      onPress={onPress}
      accessibilityRole="button"
      testID="spot-soft-ring">
      <View style={styles.ring} pointerEvents="none">
        <MaterialIcons name="photo-camera" size={28} color="rgba(255,255,255,0.35)" />
      </View>
      <Text style={styles.hint}>{hint}</Text>
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
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 12, textAlign: 'center' },
});
