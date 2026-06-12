import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ConflictTokens } from '@/constants/conflictTokens';
import { graphUnavailableCopy } from '@/lib/routine-copy';

type Props = {
  onRetry?: () => void;
};

export function GraphUnavailableBanner({ onRetry }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{graphUnavailableCopy()}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
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
  retry: { marginTop: 8, alignSelf: 'flex-start' },
  retryText: { fontSize: 13, fontWeight: '600', color: ConflictTokens.cardAmberText },
});
