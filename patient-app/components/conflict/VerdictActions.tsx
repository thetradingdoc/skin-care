import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';

type Props = {
  onRemove: () => void;
  onKeep: () => void;
  busy?: boolean;
};

export function VerdictActions({ onRemove, onKeep, busy }: Props) {
  return (
    <View style={styles.row} testID="verdict-keep-dont">
      <Pressable
        style={[styles.btn, styles.btnPrimary]}
        onPress={onRemove}
        disabled={busy}
        accessibilityRole="button"
        testID="verdict-dont-use">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Don&apos;t use</Text>}
      </Pressable>
      <Pressable
        style={[styles.btn, styles.btnOutline]}
        onPress={onKeep}
        disabled={busy}
        accessibilityRole="button"
        testID="verdict-keep">
        <Text style={styles.btnOutlineText}>Keep</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnOutline: { borderWidth: 2, borderColor: ConflictTokens.fabBg },
  btnOutlineText: { fontSize: 15, fontWeight: '700', color: ConflictTokens.fabBg },
  btnPrimary: { backgroundColor: ConflictTokens.fabBg },
  btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
