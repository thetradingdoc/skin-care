import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';
import { graphUnavailableCopy } from '@/lib/routine-copy';

export function GraphUnavailableBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{graphUnavailableCopy()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: ConflictTokens.cardAmber,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  text: { fontSize: 13, color: ConflictTokens.cardAmberText, lineHeight: 18 },
});
